const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");
const razorpay = require("../config/razorpay");
const Order = require("../models/Order");
const { sendOrderConfirmation } = require("../services/email.service");
const { finalizeReservation } = require("../services/stockReservation.service");

const router = express.Router();

// POST /api/payments/razorpay/create-order
// Body: { orderId } — the Order doc already created via POST /api/orders
router.post("/razorpay/create-order", async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(order.total * 100), // paise
      currency: "INR",
      receipt: order.orderNumber,
    });

    order.payment.razorpayOrderId = razorpayOrder.id;
    await order.save();

    res.json({
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("Razorpay order creation error:", err);
    res.status(500).json({ message: "Failed to initiate Razorpay order" });
  }
});

// POST /api/payments/razorpay/verify
// Body: { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature }
router.post("/razorpay/verify", async (req, res) => {
  const {
    orderId,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = req.body;

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expected !== razorpay_signature) {
    return res.status(400).json({ message: "Payment verification failed" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findById(orderId)
      .populate("user", "name email")
      .session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Order not found" });
    }

    // Idempotency check: if webhook already finalized this order, don't duplicate decrement
    if (order.payment.status === "paid") {
      await session.abortTransaction();
      session.endSession();
      return res.json({ message: "Payment already verified", order });
    }

    order.payment.status = "paid";
    order.payment.razorpayPaymentId = razorpay_payment_id;
    order.status = "confirmed";
    order.statusHistory.push({ status: "confirmed" });
    await order.save({ session });

    // Atomically decrement stock and remove reservation inside transaction
    await finalizeReservation(order.items, session);

    await session.commitTransaction();
    session.endSession();

    sendOrderConfirmation(order).catch((err) =>
      console.error("Order email failed:", err.message),
    );

    res.json({ message: "Payment verified", order });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Verification transaction failed:", err);
    res
      .status(500)
      .json({ message: "Failed to finalize payment confirmation" });
  }
});

// POST /api/payments/razorpay/webhook — source of truth
router.post(
  "/razorpay/webhook",
  express.json({ type: "*/*" }),
  async (req, res) => {
    const signature = req.headers["x-razorpay-signature"];
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET || "")
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (signature !== expected) {
      return res.status(400).json({ message: "Invalid signature" });
    }

    const payload = req.body.payload?.payment?.entity;
    if (payload?.order_id) {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const order = await Order.findOne({
          "payment.razorpayOrderId": payload.order_id,
        })
          .populate("user", "name email")
          .session(session);

        if (order && order.payment.status !== "paid") {
          order.payment.status = "paid";
          order.payment.razorpayPaymentId = payload.id;
          order.status = "confirmed";
          order.statusHistory.push({ status: "confirmed" });
          await order.save({ session });

          await finalizeReservation(order.items, session);

          await session.commitTransaction();
          session.endSession();

          sendOrderConfirmation(order).catch((err) =>
            console.error("Order confirmation email failed:", err.message),
          );
        } else {
          await session.abortTransaction();
          session.endSession();
        }
      } catch (webhookErr) {
        await session.abortTransaction();
        session.endSession();
        console.error("Webhook processing transaction error:", webhookErr);
        return res.status(500).json({ message: "Webhook execution failed" });
      }
    }

    res.json({ received: true });
  },
);

module.exports = router;
