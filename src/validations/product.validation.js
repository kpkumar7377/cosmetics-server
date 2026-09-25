const { z } = require("zod");

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const objectIdSchema = (fieldName = "ID") =>
  z
    .string({ required_error: `${fieldName} is required` })
    .trim()
    .regex(objectIdRegex, `Invalid ${fieldName} format`);

const variantSchema = z.object({
  label: z.string().trim().min(1, "Variant label cannot be empty"),
  sku: z.string().trim().optional().default(""),
  price: z.coerce.number().min(0, "Variant price cannot be negative"),
  stock: z.coerce
    .number()
    .int()
    .min(0, "Variant stock cannot be negative")
    .default(0),
});

const discountSchema = z
  .object({
    isActive: z.boolean().default(false),
    percent: z.coerce
      .number()
      .min(0, "Discount percentage cannot be negative")
      .max(100, "Discount percentage cannot exceed 100")
      .default(0),
    validUntil: z.coerce.date().nullable().optional(),
  })
  .optional();

// 1. Raw Object Schema (has .partial())
const baseProductSchema = z.object({
  name: z
    .string({ required_error: "Product name is required" })
    .trim()
    .min(2, "Product name must be at least 2 characters")
    .max(200, "Product name cannot exceed 200 characters"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be URL-safe (lowercase alphanumeric with hyphens)",
    )
    .optional(),
  description: z.string().trim().default(""),
  category: objectIdSchema("Category"),
  basePrice: z.coerce
    .number({ required_error: "Base price is required" })
    .min(0, "Base price cannot be negative"),
  stock: z.coerce.number().int().min(0, "Stock cannot be negative").default(0),
  images: z
    .array(z.string().trim().url("Each image must be a valid URL"))
    .default([]),
  variants: z.array(variantSchema).default([]),
  discount: discountSchema,
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  tags: z.array(z.string().trim()).default([]),
});

// Helper transformation function to zero out stock if variants exist
const applyStockLogic = (data) => {
  if (data.variants && data.variants.length > 0) {
    data.stock = 0;
  }
  return data;
};

// 2. Create Schema: Apply transformation on raw object
const productBodySchema = baseProductSchema.transform(applyStockLogic);

// 3. Update Schema: Call .partial() on raw object first, then apply transformation
const productUpdateSchema = baseProductSchema
  .partial()
  .transform(applyStockLogic);

const listProductsQuerySchema = z.object({
  category: z.string().trim().optional(),
  search: z.string().trim().optional(),
  sale: z.enum(["true", "false"]).optional(),
  featured: z.enum(["true", "false"]).optional(),
  sort: z
    .enum(["featured", "priceLow", "priceHigh", "name", "newest", "bestseller"])
    .optional(),
  limit: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().optional(),
});

const adminListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(10),
  search: z.string().trim().optional(),
});

const productIdParamSchema = z.object({
  id: objectIdSchema("Product ID"),
});

const productSlugParamSchema = z.object({
  slug: z
    .string({ required_error: "Slug is required" })
    .trim()
    .toLowerCase()
    .min(1, "Slug cannot be empty"),
});

const suggestQuerySchema = z.object({
  q: z.string().trim().default(""),
});

module.exports = {
  productBodySchema,
  productUpdateSchema,
  listProductsQuerySchema,
  adminListQuerySchema,
  productIdParamSchema,
  productSlugParamSchema,
  suggestQuerySchema,
};
