const express = require("express");
const Banner = require("../models/Banner");
const { protect } = require("../middleware/auth.middleware");
const { adminOnly } = require("../middleware/admin.middleware");
const {
  cacheMiddleware,
  invalidateCache,
} = require("../middleware/cache.middleware");
const { validate } = require("../middleware/validate.middleware");
const {
  bannerIdParamSchema,
  bannerBodySchema,
  bannerUpdateSchema,
} = require("../validations/banner.validation");

const router = express.Router();

// GET /api/banners (Public) — Cached in Redis (TTL: 86400s / 24 hrs)
router.get("/", cacheMiddleware("banners", 86400), async (req, res, next) => {
  try {
    const banners = await Banner.find({ isActive: true })
      .sort({ order: 1 })
      .lean();
    return res.json(banners);
  } catch (err) {
    next(err);
  }
});

// POST /api/banners (Admin)
router.post(
  "/",
  protect,
  adminOnly,
  validate(bannerBodySchema, "body"),
  async (req, res, next) => {
    try {
      const banner = await Banner.create(req.body);
      await invalidateCache("banners");
      return res.status(201).json(banner);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /api/banners/:id (Admin)
router.put(
  "/:id",
  protect,
  adminOnly,
  validate(bannerIdParamSchema, "params"),
  validate(bannerUpdateSchema, "body"),
  async (req, res, next) => {
    try {
      const updated = await Banner.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      });

      if (!updated) {
        return res.status(404).json({ message: "Banner not found" });
      }

      await invalidateCache("banners");
      return res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/banners/:id (Admin)
router.delete(
  "/:id",
  protect,
  adminOnly,
  validate(bannerIdParamSchema, "params"),
  async (req, res, next) => {
    try {
      const deleted = await Banner.findByIdAndDelete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Banner not found" });
      }

      await invalidateCache("banners");
      return res.json({ message: "Banner deleted" });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
