const express = require("express");
const {
  listProducts,
  listAllProductsAdmin,
  getProductById,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  suggestProducts,
} = require("../controllers/product.controller");
const { protect } = require("../middleware/auth.middleware");
const { adminOnly } = require("../middleware/admin.middleware");
const { cacheMiddleware } = require("../middleware/cache.middleware");
const { validate } = require("../middleware/validate.middleware");
const {
  productBodySchema,
  productUpdateSchema,
  listProductsQuerySchema,
  adminListQuerySchema,
  productIdParamSchema,
  productSlugParamSchema,
  suggestQuerySchema,
} = require("../validations/product.validation");

const router = express.Router();

// Public routes
router.get(
  "/",
  validate(listProductsQuerySchema, "query"),
  cacheMiddleware("products", 1800),
  listProducts,
);
router.get(
  "/suggest",
  validate(suggestQuerySchema, "query"),
  cacheMiddleware("products", 1800),
  suggestProducts,
);

// Admin routes (No caching) - placed before /:slug
router.get(
  "/admin/all",
  protect,
  adminOnly,
  validate(adminListQuerySchema, "query"),
  listAllProductsAdmin,
);
router.get(
  "/admin/:id",
  protect,
  adminOnly,
  validate(productIdParamSchema, "params"),
  getProductById,
);
router.post(
  "/",
  protect,
  adminOnly,
  validate(productBodySchema, "body"),
  createProduct,
);
router.put(
  "/:id",
  protect,
  adminOnly,
  validate(productIdParamSchema, "params"),
  validate(productUpdateSchema, "body"),
  updateProduct,
);
router.delete(
  "/:id",
  protect,
  adminOnly,
  validate(productIdParamSchema, "params"),
  deleteProduct,
);

// Public dynamic slug route (placed after fixed admin routes)
router.get(
  "/:slug",
  validate(productSlugParamSchema, "params"),
  cacheMiddleware("products", 1800),
  getProduct,
);

module.exports = router;
