const { z } = require("zod");

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const categoryIdParamSchema = z.object({
  id: z
    .string({ required_error: "Category ID is required" })
    .trim()
    .regex(objectIdRegex, "Invalid Category ID format"),
});

const listCategoriesQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

const baseCategorySchema = z.object({
  name: z
    .string({ required_error: "Category name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name cannot exceed 80 characters"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be URL-safe (lowercase alphanumeric with hyphens)",
    )
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .default(""),
  image: z
    .string()
    .trim()
    .url("Category image must be a valid URL")
    .optional()
    .or(z.literal("")),
  isActive: z.boolean().optional().default(true),
});

const categoryBodySchema = baseCategorySchema;
const categoryUpdateSchema = baseCategorySchema.partial();

module.exports = {
  categoryIdParamSchema,
  listCategoriesQuerySchema,
  categoryBodySchema,
  categoryUpdateSchema,
};
