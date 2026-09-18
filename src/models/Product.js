const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true },
    label: { type: String, required: true },
    price: { type: Number, required: true },
    stock: { type: Number, default: 0 },
    reservedStock: { type: Number, default: 0 }, // held by unpaid Razorpay orders mid-checkout
  },
  { _id: false },
);

const discountSchema = new mongoose.Schema(
  {
    isActive: { type: Boolean, default: false },
    percent: { type: Number, min: 0, max: 90 },
    originalPrice: Number,
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: String,
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    images: [String], // Cloudinary URLs
    variants: [variantSchema],
    basePrice: { type: Number, required: true }, // fallback when no variants apply
    // Stock for products with NO variants. Ignored/irrelevant once a product
    // has variants — stock is tracked per-variant instead in that case.
    stock: { type: Number, default: 0 },
    reservedStock: { type: Number, default: 0 }, // held by unpaid Razorpay orders mid-checkout (no-variant products)
    discount: discountSchema,
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    codEligible: { type: Boolean, default: true }, // admin toggle — is this product available for Cash on Delivery
  },
  { timestamps: true },
);

productSchema.index({ name: "text", description: "text" });

module.exports = mongoose.model("Product", productSchema);
