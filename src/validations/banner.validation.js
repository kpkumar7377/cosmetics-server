const { z } = require("zod");

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const bannerIdParamSchema = z.object({
  id: z
    .string({ required_error: "Banner ID is required" })
    .trim()
    .regex(objectIdRegex, "Invalid Banner ID format"),
});

const baseBannerSchema = z.object({
  title: z
    .string({ required_error: "Banner title is required" })
    .trim()
    .min(1, "Title cannot be empty")
    .max(120, "Title cannot exceed 120 characters"),
  subtitle: z
    .string()
    .trim()
    .max(250, "Subtitle cannot exceed 250 characters")
    .optional()
    .default(""),
  image: z
    .string({ required_error: "Banner image URL is required" })
    .trim()
    .url("Banner image must be a valid URL"),
  link: z.string().trim().optional().default(""),
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
