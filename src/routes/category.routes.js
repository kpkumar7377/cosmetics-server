const express = require("express");
const Category = require("../models/Category");
const { protect } = require("../middleware/auth.middleware");
const { adminOnly } = require("../middleware/admin.middleware");
const {
  cacheMiddleware,
  invalidateCache,
} = require("../middleware/cache.middleware");
const { validate } = require("../middleware/validate.middleware");
const {
  categoryIdParamSchema,
  listCategoriesQuerySchema,
  categoryBodySchema,
  categoryUpdateSchema,
} = require("../validations/category.validation");

const router = express.Router();

// GET /api/categories (Public)
router.get(
  "/",
  validate(listCategoriesQuerySchema, "query"),
  cacheMiddleware("categories", 3600),
  async (req, res, next) => {
    try {
      const { search, page, limit } = req.query;
      const filter = { isActive: true };

      if (search) {
        filter.name = new RegExp(search, "i");
      }

      const isPaginated = Boolean(page || limit);

      if (!isPaginated) {
        const categories = await Category.find(filter).sort({ name: 1 }).lean();
        return res.json(categories);
      }

      const pageNum = page || 1;
      const limitNum = limit || 8;
      const skip = (pageNum - 1) * limitNum;

      const [total, categories] = await Promise.all([
        Category.countDocuments(filter),
        Category.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
      ]);

      return res.json({
        categories,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 1,
          hasMore: skip + categories.length < total,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/categories (Admin)
router.post(
  "/",
  protect,
  adminOnly,
  validate(categoryBodySchema, "body"),
  async (req, res, next) => {
    try {
      const category = await Category.create(req.body);
      await Promise.all([
        invalidateCache("categories"),
        invalidateCache("products"),
      ]);
      return res.status(201).json(category);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /api/categories/:id (Admin)
router.put(
  "/:id",
  protect,
  adminOnly,
  validate(categoryIdParamSchema, "params"),
  validate(categoryUpdateSchema, "body"),
  async (req, res, next) => {
    try {
      const updated = await Category.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
          runValidators: true,
        },
      );

      if (!updated) {
        return res.status(404).json({ message: "Category not found" });
      }

      await Promise.all([
        invalidateCache("categories"),
        invalidateCache("products"),
      ]);
      return res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/categories/:id (Admin)
router.delete(
  "/:id",
  protect,
  adminOnly,
  validate(categoryIdParamSchema, "params"),
  async (req, res, next) => {
    try {
      const deleted = await Category.findByIdAndDelete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Category not found" });
      }

      await Promise.all([
        invalidateCache("categories"),
        invalidateCache("products"),
      ]);
      return res.json({ message: "Category deleted" });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
