const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantSku: String,
    name: String,
    image: String,
    price: Number,
    qty: Number,
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // null for guest checkout
    guestInfo: {
      name: String,
      email: String,
      phone: String,
    },
    items: [orderItemSchema],
    shippingAddress: {
      name: String,
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String,
      phone: String,
    },
    subtotal: Number,
    discountAmount: { type: Number, default: 0 },
    shippingFee: { type: Number, default: 0 }, // Total shipping fee (deliveryFee + codFee)
    deliveryFee: { type: Number, default: 0 }, // Base courier delivery fee
    codFee: { type: Number, default: 0 },
    total: Number,

    payment: {
      method: { type: String, enum: ["razorpay", "cod"], default: "razorpay" },
      status: {
        type: String,
        enum: ["pending", "paid", "failed"],
        default: "pending",
      },
      razorpayOrderId: String,
      razorpayPaymentId: String,
    },

    shipment: {
      shiprocketOrderId: String,
      awbCode: String,
      courierName: String,
      trackingStatus: String,
      trackingUrl: String,
    },

    status: {
      type: String,
      enum: [
        "placed",
        "confirmed",
        "shipped",
        "delivered",
        "cancelled",
        "expired",
        "return_requested",
        "return_approved",
        "return_rejected",
        "returned",
      ],
      default: "placed",
    },
    returnRequest: {
      reason: String,
      notes: String,
      photos: [String], // Cloudinary image URLs
      bankAccount: {
        accountHolderName: String,
        accountNumber: String,
        ifscCode: String,
        bankName: String,
      },
      shiprocketReturnOrderId: String,
      shiprocketReturnShipmentId: String,
      reverseAwb: String,
      refund: {
        amount: Number,
        type: { type: String, enum: ["full", "partial"] },
        referenceId: String, // UTR / Netbanking Transaction Reference ID
        paymentMode: { type: String, default: "netbanking" },
        refundedAt: Date,
        adminNotes: String,
      },
      status: {
        type: String,
        enum: ["pending", "approved", "rejected", "completed"],
      },
      requestedAt: Date,
      processedAt: Date,
    },
    // Only set for razorpay orders — the reservation window closes at this time.
    paymentExpiresAt: Date,
    // Guards against double-releasing the same reservation.
    stockReleased: { type: Boolean, default: false },

    statusHistory: [
      {
        status: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Order", orderSchema);
