const express = require("express");
const Category = require("../models/Category");
const { protect } = require("../middleware/auth.middleware");
const { adminOnly } = require("../middleware/admin.middleware");
const {
  cacheMiddleware,
  invalidateCache,
} = require("../middleware/cache.middleware");

const router = express.Router();

// GET /api/categories (Public) — Cached in Redis (TTL: 3600s / 1 hr)
router.get("/", cacheMiddleware("categories", 3600), async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : "";
    const filter = { isActive: true };

    if (search) {
      filter.name = new RegExp(search, "i");
    }

    // Check if client requested pagination
    const isPaginated = Boolean(req.query.page || req.query.limit);

    if (!isPaginated) {
      const categories = await Category.find(filter).sort({ name: 1 }).lean();
      return res.json(categories);
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 8);
    const skip = (page - 1) * limit;

    const [total, categories] = await Promise.all([
      Category.countDocuments(filter),
      Category.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    res.json({
      categories,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore: skip + categories.length < total,
      },
    });
  } catch (err) {
    console.error("Categories fetch error:", err);
    res.status(500).json({ message: "Failed to load categories" });
  }
});

// POST /api/categories (Admin)
router.post("/", protect, adminOnly, async (req, res) => {
  try {
    const category = await Category.create(req.body);
    await Promise.all([
      invalidateCache("categories"),
      invalidateCache("products"),
    ]);
    res.status(201).json(category);
  } catch (err) {
    console.error("Create category error:", err);
    res
      .status(400)
      .json({ message: err.message || "Failed to create category" });
  }
});

// PUT /api/categories/:id (Admin)
router.put("/:id", protect, adminOnly, async (req, res) => {
  try {
    const updated = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updated) {
      return res.status(404).json({ message: "Category not found" });
    }

    await Promise.all([
      invalidateCache("categories"),
      invalidateCache("products"),
    ]);
    res.json(updated);
  } catch (err) {
    console.error("Update category error:", err);
    res
      .status(400)
      .json({ message: err.message || "Failed to update category" });
  }
});

// DELETE /api/categories/:id (Admin)
router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    const deleted = await Category.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Category not found" });
    }

    await Promise.all([
      invalidateCache("categories"),
      invalidateCache("products"),
    ]);
    res.json({ message: "Category deleted" });
  } catch (err) {
    console.error("Delete category error:", err);
    res.status(500).json({ message: "Failed to delete category" });
  }
});

module.exports = router;
