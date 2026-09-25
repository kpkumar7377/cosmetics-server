const { z } = require("zod");

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const bannerIdParamSchema = z.object({
  id: z
    .string({ required_error: "Banner ID is required" })
    .trim()
    .regex(objectIdRegex, "Invalid Banner ID format"),
});

const baseBannerSchema = z.object({
  imageUrl: z
    .string({ required_error: "Banner image URL is required" })
    .trim()
    .url("Banner image must be a valid URL"),
  mobileImageUrl: z
    .string()
    .trim()
    .url("Mobile image must be a valid URL")
    .nullable()
    .optional()
    .default(null),
  order: z.coerce.number().int().min(0, "Order cannot be negative").default(0),
  isActive: z.boolean().optional().default(true),
});

const bannerBodySchema = baseBannerSchema;
const bannerUpdateSchema = baseBannerSchema.partial();

module.exports = {
  bannerIdParamSchema,
  bannerBodySchema,
  bannerUpdateSchema,
};
