const { z } = require("zod");

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const objectIdSchema = (fieldName = "ID") =>
  z
    .string({ required_error: `${fieldName} is required` })
    .trim()
    .regex(objectIdRegex, `Invalid ${fieldName} format`);

const orderIdParamSchema = z.object({
  id: z
    .string({ required_error: "Order ID is required" })
    .trim()
    .min(1, "Order identifier cannot be empty"),
});

// Accepts either productId or product/_id
const orderItemSchema = z
  .object({
    productId: z.string().trim().optional(),
    product: z.string().trim().optional(),
    _id: z.string().trim().optional(),
    variantSku: z.string().trim().nullable().optional(),
    qty: z.coerce.number().int().positive("Quantity must be at least 1"),
  })
  .transform((item) => ({
    productId: item.productId || item.product || item._id,
    variantSku: item.variantSku || undefined,
    qty: item.qty,
  }))
  .refine(
    (item) => Boolean(item.productId && objectIdRegex.test(item.productId)),
    {
      message: "Invalid or missing Product ID in items array",
      path: ["productId"],
    },
  );

// Accepts line1, street, or address interchangeably
const shippingAddressSchema = z
  .object({
    name: z.string().trim().min(1, "Recipient name is required"),
    phone: z.string().trim().min(5, "Recipient phone number is required"),
    line1: z.string().trim().optional(),
    street: z.string().trim().optional(),
    address: z.string().trim().optional(),
    line2: z.string().trim().nullable().optional().default(""),
    city: z.string().trim().min(1, "City is required"),
    state: z.string().trim().min(1, "State is required"),
    pincode: z.string().trim().min(3, "Pincode is required"),
    country: z.string().trim().optional().default("India"),
  })
  .transform((addr) => ({
    name: addr.name,
    phone: addr.phone,
    line1: addr.line1 || addr.street || addr.address || "",
    street: addr.street || addr.line1 || addr.address || "",
    line2: addr.line2 || "",
    city: addr.city,
    state: addr.state,
    pincode: addr.pincode,
    country: addr.country || "India",
  }))
  .refine((addr) => Boolean(addr.line1 && addr.line1.length > 0), {
    message: "Street/Address line 1 is required",
    path: ["line1"],
  });

const guestInfoSchema = z
  .object({
    name: z.string().trim().optional().default(""),
    email: z.string().trim().toLowerCase().optional().default(""),
    phone: z.string().trim().optional().default(""),
  })
  .nullable()
  .optional();

const createOrderSchema = z.object({
  items: z.array(orderItemSchema).nonempty("Cart cannot be empty"),
  shippingAddress: shippingAddressSchema,
  guestInfo: guestInfoSchema,
  paymentMethod: z.enum(["cod", "razorpay"], {
    required_error: "Payment method must be 'cod' or 'razorpay'",
  }),
});

const estimateShippingQuerySchema = z.object({
  subtotal: z.coerce.number().min(0, "Subtotal cannot be negative").default(0),
  paymentMethod: z.enum(["cod", "razorpay", "online"]).optional(),
});

const allOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(10),
  status: z.string().trim().default("all"),
  search: z.string().trim().optional(),
});

const updateOrderStatusSchema = z.object({
  status: z.enum([
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
  ]),
});

const cancelOrderSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(500, "Reason cannot exceed 500 characters")
    .optional(),
});

const bankAccountSchema = z.object({
  accountHolderName: z
    .string({ required_error: "Account holder name is required" })
    .trim()
    .min(2, "Account holder name is required"),
  accountNumber: z
    .string({ required_error: "Bank account number is required" })
    .trim()
    .min(6, "Account number must be at least 6 digits"),
  ifscCode: z
    .string({ required_error: "IFSC code is required" })
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z]{4}0[A-Z0-9]{6}$/,
      "Invalid Indian IFSC format (e.g. HDFC0001234)",
    ),
  bankName: z.string().trim().optional().default(""),
});

const requestReturnSchema = z.object({
  reason: z
    .string({ required_error: "Return reason is required" })
    .trim()
    .min(3, "Please describe the reason for return"),
  notes: z.string().trim().optional().default(""),
  photos: z
    .array(z.string().trim().url("Photo must be a valid URL"))
    .default([]),
  bankAccount: bankAccountSchema,
  saveAccount: z.boolean().optional().default(false),
});

const reviewReturnSchema = z
  .object({
    action: z.enum(["approve", "reject"], {
      required_error: "Action must be either 'approve' or 'reject'",
    }),
    rejectReason: z.string().trim().optional(),
  })
  .refine(
    (data) =>
      data.action === "reject"
        ? Boolean(data.rejectReason && data.rejectReason.length > 0)
        : true,
    {
      message: "Rejection reason is required when rejecting a return",
      path: ["rejectReason"],
    },
  );

const processRefundSchema = z.object({
  refundAmount: z.coerce
    .number()
    .positive("Refund amount must be greater than 0"),
  referenceId: z
    .string({ required_error: "Reference ID is required" })
    .trim()
    .min(3, "Transaction reference ID is required"),
  adminNotes: z.string().trim().optional().default(""),
});

module.exports = {
  orderIdParamSchema,
  createOrderSchema,
  estimateShippingQuerySchema,
  allOrdersQuerySchema,
  updateOrderStatusSchema,
  cancelOrderSchema,
  requestReturnSchema,
  reviewReturnSchema,
  processRefundSchema,
};
