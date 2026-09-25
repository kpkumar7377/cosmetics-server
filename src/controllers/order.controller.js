const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const Setting = require("../models/Setting");
const razorpay = require("../config/razorpay");
const { invalidateCache } = require("../middleware/cache.middleware");
const {
  sendReturnApprovedEmail,
  sendReturnRejectedEmail,
  sendRefundProcessedEmail,
} = require("../services/email.service");
const {
  createReversePickup,
  cancelShipment,
} = require("../services/shiprocket.service");
const {
  reservationDeadline,
  reserveStock,
  releaseExpiredReservations,
} = require("../services/stockReservation.service");

// Configurable return policy window from environment variable (defaults to 7 days)
const RETURN_WINDOW_DAYS = parseInt(process.env.RETURN_WINDOW_DAYS, 10) || 7;

const generateOrderNumber = () => {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${Date.now().toString().slice(-6)}${rand}`;
};

// Helper to pull current active shipping configuration from DB
const getActiveShippingConfig = async () => {
  const config = await Setting.findOne({ key: "shipping_config" });
  return {
    standardFee: config?.standardShippingFee ?? 49,
    threshold: config?.freeShippingThreshold ?? 499,
    codFee: config?.codConvenienceFee ?? 29,
  };
};

// GET /api/orders/estimate-shipping
const estimateShipping = async (req, res) => {
  try {
    const { subtotal, paymentMethod } = req.query;
    const isCod = paymentMethod === "cod";

    const { standardFee, threshold, codFee } = await getActiveShippingConfig();

    const isFreeShipping = subtotal >= threshold;
    const baseShipping = isFreeShipping ? 0 : standardFee;
    const codSurcharge = isCod ? codFee : 0;
    const totalShippingFee = baseShipping + codSurcharge;

    return res.json({
      shippingFee: totalShippingFee,
      baseShipping,
      codFee: codSurcharge,
      isFreeShipping,
      threshold,
      standardFee,
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to estimate shipping" });
  }
};

// POST /api/orders
const createOrder = async (req, res, next) => {
  await releaseExpiredReservations();

  const { items, shippingAddress, guestInfo, paymentMethod } = req.body;

  if (!req.user && !guestInfo?.email) {
    return res.status(400).json({
      message: "Guest checkout requires guestInfo (name, email, phone)",
    });
  }

  const isCod = paymentMethod === "cod";
  const resolvedItems = [];
  let subtotal = 0;
  let discountAmount = 0;

  // Step 1: Pre-validate product data, pricing, and availability
  for (const item of items) {
    const product = await Product.findById(item.productId);
    if (!product || !product.isActive) {
      return res
        .status(400)
        .json({ message: `Product unavailable: ${item.productId}` });
    }

    if (isCod && product.codEligible === false) {
      return res.status(400).json({
        message: `Cash on Delivery is not available for "${product.name}". Please choose online payment or remove this item.`,
      });
    }

    let unitPrice = Number(product.basePrice) || 0;
    let variantLabel = null;

    if (item.variantSku && product.variants?.length) {
      const variant = product.variants.find((v) => v.sku === item.variantSku);
      if (!variant) {
        return res
          .status(400)
          .json({ message: `Variant not found: ${item.variantSku}` });
      }
      if (variant.stock - (variant.reservedStock || 0) < item.qty) {
        return res.status(400).json({
          message: `Insufficient stock for ${product.name} (${variant.label})`,
        });
      }
      unitPrice = Number(variant.price) || 0;
      variantLabel = variant.label;
    } else if (!product.variants?.length) {
      if (product.stock - (product.reservedStock || 0) < item.qty) {
        return res
          .status(400)
          .json({ message: `Insufficient stock for ${product.name}` });
      }
    }

    let finalUnitPrice = unitPrice;
    const discountPercent =
      product.discount?.percent ?? product.discount?.percentage ?? 0;

    if (product.discount?.isActive && discountPercent > 0) {
      finalUnitPrice = Math.round(
        unitPrice * (1 - Number(discountPercent) / 100),
      );
      discountAmount += (unitPrice - finalUnitPrice) * item.qty;
    }

    subtotal += unitPrice * item.qty;

    resolvedItems.push({
      product: product._id,
      variantSku: item.variantSku,
      name: variantLabel ? `${product.name} — ${variantLabel}` : product.name,
      image: product.images?.[0] || "",
      price: finalUnitPrice,
      qty: item.qty,
    });
  }

  // Step 2: Shipping calculations
  const { standardFee, threshold, codFee } = await getActiveShippingConfig();
  const netSubtotal = Math.max(0, subtotal - discountAmount);
  const isFreeShipping = netSubtotal >= threshold;
  const baseShipping = isFreeShipping ? 0 : standardFee;
  const appliedCodFee = isCod ? codFee : 0;
  const dynamicShippingFee = baseShipping + appliedCodFee;
  const total = netSubtotal + dynamicShippingFee;

  // Step 3: Transaction execution
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const orderDoc = new Order({
      orderNumber: generateOrderNumber(),
      user: req.user?._id || undefined,
      guestInfo: req.user ? undefined : guestInfo,
      items: resolvedItems,
      shippingAddress,
      subtotal,
      discountAmount,
      shippingFee: dynamicShippingFee,
      deliveryFee: baseShipping,
      codFee: appliedCodFee,
      total,
      payment: {
        method: isCod ? "cod" : "razorpay",
        status: "pending",
      },
      status: isCod ? "confirmed" : "placed",
      statusHistory: [{ status: isCod ? "confirmed" : "placed" }],
      paymentExpiresAt: isCod ? undefined : reservationDeadline(),
    });

    const [createdOrder] = await Order.create([orderDoc.toObject()], {
      session,
    });

    if (isCod) {
      for (const item of items) {
        let updated;
        if (item.variantSku) {
          updated = await Product.findOneAndUpdate(
            {
              _id: item.productId,
              "variants.sku": item.variantSku,
              "variants.stock": { $gte: item.qty },
            },
            { $inc: { "variants.$.stock": -item.qty } },
            { session, new: true },
          );
        } else {
          updated = await Product.findOneAndUpdate(
            {
              _id: item.productId,
              stock: { $gte: item.qty },
            },
            { $inc: { stock: -item.qty } },
            { session, new: true },
          );
        }

        if (!updated) {
          throw new Error(
            `Insufficient stock for item during final confirmation: ${item.productId}`,
          );
        }
      }
    } else {
      await reserveStock(items);
    }

    await session.commitTransaction();
    session.endSession();

    if (isCod) {
      invalidateCache("products");
      const { sendOrderConfirmation } = require("../services/email.service");
      const orderForEmail = { ...createdOrder.toObject(), user: req.user };

      try {
        await sendOrderConfirmation(orderForEmail);
      } catch (err) {
        console.error("Order email failed:", err.message);
      }
    }

    return res.status(201).json(createdOrder);
  } catch (txError) {
    await session.abortTransaction();
    session.endSession();
    console.error("[Order Creation Error]:", txError.message);
    return res
      .status(400)
      .json({ message: txError.message || "Order placement failed." });
  }
};

// GET /api/orders/my
const myOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({
      createdAt: -1,
    });
    return res.json(orders);
  } catch (error) {
    next(error);
  }
};

// GET /api/orders (admin)
const allOrders = async (req, res) => {
  try {
    const { page, limit, status, search } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (status && status !== "all") {
      filter.status = status;
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { orderNumber: searchRegex },
        { "shippingAddress.name": searchRegex },
        { "shippingAddress.city": searchRegex },
        { "shippingAddress.phone": searchRegex },
        { "guestInfo.name": searchRegex },
        { "guestInfo.email": searchRegex },
      ];
    }

    const [orders, total, countsByStatus, aggregateMetrics] = await Promise.all(
      [
        Order.find(filter)
          .populate("user", "name email")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),

        Order.countDocuments(filter),

        Order.aggregate([
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ]),

        Order.aggregate([
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              revenue: {
                $sum: {
                  $cond: [{ $ne: ["$status", "cancelled"] }, "$total", 0],
                },
              },
              pendingAction: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        "$status",
                        ["placed", "confirmed", "return_requested"],
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              codPending: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$payment.method", "cod"] },
                        { $ne: ["$payment.status", "paid"] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              delivered: {
                $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
              },
            },
          },
        ]),
      ],
    );

    const statusCounts = { all: 0 };
    countsByStatus.forEach((item) => {
      statusCounts[item._id] = item.count;
      statusCounts.all += item.count;
    });

    const metrics = aggregateMetrics[0] || {
      revenue: 0,
      totalOrders: 0,
      pendingAction: 0,
      codPending: 0,
      delivered: 0,
    };

    return res.json({
      orders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore: skip + orders.length < total,
      },
      statusCounts,
      metrics,
    });
  } catch (err) {
    console.error("Fetch orders error:", err);
    return res.status(500).json({ message: "Failed to load orders" });
  }
};

// GET /api/orders/:id
const getOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const query = mongoose.isValidObjectId(id)
      ? { _id: id }
      : { orderNumber: id };

    const order = await Order.findOne(query).populate("user", "name email");
    if (!order) return res.status(404).json({ message: "Order not found" });

    const isOwner =
      order.user && String(order.user._id) === String(req.user._id);
    if (req.user.role !== "admin" && !isOwner) {
      return res
        .status(403)
        .json({ message: "Not authorized to view this order" });
    }

    return res.json(order);
  } catch (error) {
    next(error);
  }
};

// PATCH /api/orders/:id/status
const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const ALLOWED_STATUSES = [
      "placed",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
      "returned",
      "return_requested",
      "return_approved",
      "return_rejected",
    ];

    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `Invalid status "${status}". Allowed values: ${ALLOWED_STATUSES.join(", ")}`,
      });
    }

    // Populate user to ensure email/name exist if notification triggers
    const order = await Order.findById(req.params.id).populate(
      "user",
      "name email",
    );
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Prevent redundant updates
    if (order.status === status) {
      return res.json(order);
    }

    // Disallow moving out of terminal states without formal refund/restock flows
    if (["cancelled", "returned"].includes(order.status)) {
      return res.status(400).json({
        message: `Cannot update an order that is already in terminal state "${order.status}".`,
      });
    }

    order.status = status;
    order.statusHistory.push({
      status,
      timestamp: new Date(),
    });

    // Auto-mark COD as paid once delivered
    if (status === "delivered" && order.payment?.method === "cod") {
      order.payment.status = "paid";
    }

    order.markModified("statusHistory");
    order.markModified("payment");
    await order.save();

    // Optional: Trigger shipping/delivered status email notifications
    // (non-blocking so it won't stall admin response)
    if (status === "shipped" || status === "delivered") {
      const recipientEmail =
        order.user?.email ||
        order.guestInfo?.email ||
        order.shippingAddress?.email;

      if (recipientEmail) {
        // You can dispatch standard status emails here if defined in email.service
        console.log(
          `[Order Status Update]: Notifying ${recipientEmail} of status "${status}"`,
        );
      }
    }

    return res.json(order);
  } catch (error) {
    next(error);
  }
};

// PATCH /api/orders/:id/collect-cod
const collectCodPayment = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.payment.method !== "cod") {
      return res
        .status(400)
        .json({ message: "This order was not placed as Cash on Delivery" });
    }

    order.payment.status = "paid";
    await order.save();
    return res.json(order);
  } catch (error) {
    next(error);
  }
};

// POST /api/orders/:id/cancel
const cancelOrder = async (req, res) => {
  const { reason } = req.body;
  const order = await Order.findById(req.params.id);

  if (!order) return res.status(404).json({ message: "Order not found" });

  const isOwner = order.user && String(order.user) === String(req.user._id);
  if (req.user.role !== "admin" && !isOwner) {
    return res
      .status(403)
      .json({ message: "Not authorized to cancel this order" });
  }

  if (
    ["shipped", "delivered", "cancelled", "returned"].includes(order.status)
  ) {
    return res.status(400).json({
      message: `Cannot cancel an order that is already ${order.status}.`,
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Restock products
    for (const item of order.items) {
      if (item.variantSku) {
        await Product.updateOne(
          { _id: item.product, "variants.sku": item.variantSku },
          { $inc: { "variants.$.stock": item.qty } },
          { session },
        );
      } else {
        await Product.updateOne(
          { _id: item.product },
          { $inc: { stock: item.qty } },
          { session },
        );
      }
    }

    // 2. Refund if online prepaid
    let refundData = null;
    if (
      order.payment.method === "razorpay" &&
      order.payment.status === "paid" &&
      order.payment.razorpayPaymentId
    ) {
      try {
        const refund = await razorpay.payments.refund(
          order.payment.razorpayPaymentId,
          {
            amount: Math.round(order.total * 100),
            notes: { reason: reason || "Customer order cancellation" },
          },
        );
        refundData = {
          amount: order.total,
          type: "full",
          referenceId: refund.id,
          paymentMode: "razorpay",
          refundedAt: new Date(),
          adminNotes: `Auto-refunded via Razorpay: ${refund.id}`,
        };
      } catch (refundErr) {
        console.error("Razorpay refund error:", refundErr);
        refundData = {
          amount: order.total,
          type: "full",
          referenceId: "MANUAL_PENDING",
          paymentMode: "netbanking",
          adminNotes: `Refund failed: ${refundErr.message}. Manual bank transfer required.`,
        };
      }
    }

    // 3. Cancel on Shiprocket if registered
    if (order.shipment?.shiprocketOrderId || order.shipment?.awbCode) {
      await cancelShipment(
        order.shipment.shiprocketOrderId || order.orderNumber,
      );
    }

    // 4. Update order record
    order.status = "cancelled";
    order.statusHistory.push({ status: "cancelled" });
    if (refundData) {
      if (!order.returnRequest) order.returnRequest = {};
      order.returnRequest.refund = refundData;
    }
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    invalidateCache("products");

    return res.json({ message: "Order cancelled successfully", order });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Cancellation Transaction Failed:", err);
    return res.status(500).json({ message: "Failed to cancel order safely." });
  }
};

// POST /api/orders/:id/return-request
const requestReturn = async (req, res, next) => {
  try {
    const { reason, notes, photos, bankAccount, saveAccount } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (String(order.user) !== String(req.user._id)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (order.status !== "delivered") {
      return res.status(400).json({
        message: "Returns can only be requested for delivered orders.",
      });
    }

    const windowMs = RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const orderPlacementTime = new Date(order.createdAt).getTime();
    const timeElapsed = Date.now() - orderPlacementTime;

    if (timeElapsed > windowMs) {
      return res.status(400).json({
        message: `The ${RETURN_WINDOW_DAYS}-day return policy window from the order placement date has expired. Returns are no longer accepted.`,
      });
    }

    if (
      order.returnRequest?.status &&
      order.returnRequest.status !== "rejected"
    ) {
      return res.status(400).json({
        message: "A return request is already in progress for this order.",
      });
    }

    if (saveAccount) {
      const user = await User.findById(req.user._id);
      if (user) {
        user.bankAccount = {
          accountHolderName: bankAccount.accountHolderName,
          accountNumber: bankAccount.accountNumber,
          ifscCode: bankAccount.ifscCode,
          bankName: bankAccount.bankName,
        };
        await user.save();
      }
    }

    order.status = "return_requested";
    order.returnRequest = {
      reason,
      notes,
      photos,
      bankAccount,
      status: "pending",
      requestedAt: new Date(),
    };

    order.statusHistory.push({ status: "return_requested" });
    await order.save();

    return res.status(200).json(order);
  } catch (error) {
    next(error);
  }
};

const reviewReturn = async (req, res, next) => {
  try {
    const { action, rejectReason } = req.body;

    const order = await Order.findById(req.params.id).populate(
      "user",
      "name email",
    );
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status !== "return_requested") {
      return res.status(400).json({
        message: "Order does not have a pending return request.",
      });
    }

    if (!order.returnRequest) {
      order.returnRequest = {};
    }

    if (action === "reject") {
      order.status = "return_rejected";
      order.returnRequest.status = "rejected";
      order.returnRequest.notes = rejectReason
        ? `${order.returnRequest.notes || ""}\n[Rejection Note]: ${rejectReason}`.trim()
        : order.returnRequest.notes;
      order.returnRequest.processedAt = new Date();
      order.statusHistory.push({ status: "return_rejected" });

      // Explicitly tell Mongoose that the nested subdocument has changed
      order.markModified("returnRequest");
      await order.save();

      // Trigger email and await or catch properly
      try {
        await sendReturnRejectedEmail(order, rejectReason);
      } catch (mailErr) {
        console.error("[Mail Error - Return Rejected]:", mailErr.message);
      }

      return res.json(order);
    }

    if (action === "approve") {
      try {
        const srRes = await createReversePickup(order);

        order.status = "return_approved";
        order.returnRequest.status = "approved";
        order.returnRequest.shiprocketReturnOrderId = srRes?.order_id
          ? String(srRes.order_id)
          : `${order.orderNumber}-RET`;
        order.returnRequest.shiprocketReturnShipmentId = srRes?.shipment_id
          ? String(srRes.shipment_id)
          : "";
        order.returnRequest.reverseAwb = srRes?.awb_code || "";
        order.returnRequest.processedAt = new Date();
        order.statusHistory.push({ status: "return_approved" });

        // Explicitly tell Mongoose that the nested subdocument has changed
        order.markModified("returnRequest");
        await order.save();

        // Trigger email and await or catch properly
        try {
          await sendReturnApprovedEmail(order);
        } catch (mailErr) {
          console.error("[Mail Error - Return Approved]:", mailErr.message);
        }

        return res.json(order);
      } catch (srErr) {
        console.error(
          "Shiprocket reverse pickup failed:",
          srErr.response?.data || srErr.message,
        );
        return res.status(500).json({
          message:
            srErr.response?.data?.message ||
            "Failed to initiate reverse pickup on Shiprocket. Please check balance and credentials.",
        });
      }
    }

    return res
      .status(400)
      .json({ message: "Invalid action. Must be 'approve' or 'reject'." });
  } catch (error) {
    next(error);
  }
};

const processManualRefund = async (req, res, next) => {
  try {
    const { refundAmount, referenceId, adminNotes } = req.body;

    const order = await Order.findById(req.params.id).populate(
      "user",
      "name email",
    );
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (
      !["return_approved", "return_requested", "delivered"].includes(
        order.status,
      )
    ) {
      return res.status(400).json({
        message: "Cannot release refund for an order in this status.",
      });
    }

    if (refundAmount > order.total) {
      return res.status(400).json({
        message: `Invalid refund amount. Cannot exceed total invoice ₹${order.total}.`,
      });
    }

    const refundType =
      Number(refundAmount) === Number(order.total) ? "full" : "partial";

    if (!order.returnRequest) {
      order.returnRequest = {};
    }

    const refundPayload = {
      amount: Number(refundAmount),
      type: refundType,
      referenceId,
      paymentMode: "netbanking",
      refundedAt: new Date(),
      adminNotes: adminNotes || "",
    };

    order.returnRequest.refund = refundPayload;
    order.returnRequest.status = "completed";
    order.status = "returned";
    order.statusHistory.push({ status: "returned" });

    // Explicitly tell Mongoose that the nested subdocument has changed
    order.markModified("returnRequest");
    await order.save();

    // Trigger refund confirmation email
    try {
      await sendRefundProcessedEmail(order, refundPayload);
    } catch (mailErr) {
      console.error("[Mail Error - Refund Processed]:", mailErr.message);
    }

    return res.json(order);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  myOrders,
  allOrders,
  getOrder,
  updateStatus,
  collectCodPayment,
  cancelOrder,
  requestReturn,
  reviewReturn,
  processManualRefund,
  estimateShipping,
};
