const { z } = require("zod");

const updateShippingConfigSchema = z.object({
  standardShippingFee: z.coerce
    .number({ required_error: "Standard shipping fee is required" })
    .min(0, "Standard shipping fee cannot be negative")
    .default(0),
  freeShippingThreshold: z.coerce
    .number({ required_error: "Free shipping threshold is required" })
    .min(0, "Free shipping threshold cannot be negative")
    .default(0),
  codConvenienceFee: z.coerce
    .number({ required_error: "COD convenience fee is required" })
    .min(0, "COD convenience fee cannot be negative")
    .default(0),
});

module.exports = {
  updateShippingConfigSchema,
};
