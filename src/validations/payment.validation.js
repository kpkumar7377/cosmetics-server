const { z } = require("zod");

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const createRazorpayOrderSchema = z.object({
  orderId: z
    .string({ required_error: "Order ID is required" })
    .trim()
    .regex(objectIdRegex, "Invalid Order ID format"),
});

const verifyRazorpayPaymentSchema = z.object({
  orderId: z
    .string({ required_error: "Order ID is required" })
    .trim()
    .regex(objectIdRegex, "Invalid Order ID format"),
  razorpay_order_id: z
    .string({ required_error: "Razorpay Order ID is required" })
    .trim()
    .min(1, "Razorpay Order ID cannot be empty"),
  razorpay_payment_id: z
    .string({ required_error: "Razorpay Payment ID is required" })
    .trim()
    .min(1, "Razorpay Payment ID cannot be empty"),
  razorpay_signature: z
    .string({ required_error: "Razorpay Signature is required" })
    .trim()
    .min(1, "Razorpay Signature cannot be empty"),
});

module.exports = {
  createRazorpayOrderSchema,
  verifyRazorpayPaymentSchema,
};
