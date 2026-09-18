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

const router = express.Router();

// Public routes with Redis caching (TTL: 1800s / 30 mins)
router.get("/", cacheMiddleware("products", 1800), listProducts);
router.get("/suggest", cacheMiddleware("products", 1800), suggestProducts);
router.get("/:slug", cacheMiddleware("products", 1800), getProduct);

// Admin routes (No caching)
router.get("/admin/all", protect, adminOnly, listAllProductsAdmin);
router.get("/admin/:id", protect, adminOnly, getProductById);
router.post("/", protect, adminOnly, createProduct);
router.put("/:id", protect, adminOnly, updateProduct);
router.delete("/:id", protect, adminOnly, deleteProduct);

module.exports = router;
