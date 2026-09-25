const { z } = require("zod");

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const shipmentOrderIdParamSchema = z.object({
  orderId: z
    .string({ required_error: "Order ID is required" })
    .trim()
    .regex(objectIdRegex, "Invalid Order ID format"),
});

module.exports = {
  shipmentOrderIdParamSchema,
};
