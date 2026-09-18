const express = require("express");
const Banner = require("../models/Banner");
const { protect } = require("../middleware/auth.middleware");
const { adminOnly } = require("../middleware/admin.middleware");
const {
  cacheMiddleware,
  invalidateCache,
} = require("../middleware/cache.middleware");

const router = express.Router();

// GET /api/banners (Public) — Cached in Redis (TTL: 86400s / 24 hrs)
router.get("/", cacheMiddleware("banners", 86400), async (req, res) => {
  try {
    const banners = await Banner.find({ isActive: true })
      .sort({ order: 1 })
      .lean();
    res.json(banners);
  } catch (err) {
    console.error("Fetch banners error:", err);
    res.status(500).json({ message: "Failed to load banners" });
  }
});

// POST /api/banners (Admin)
router.post("/", protect, adminOnly, async (req, res) => {
  try {
    const banner = await Banner.create(req.body);
    await invalidateCache("banners");
    res.status(201).json(banner);
  } catch (err) {
    console.error("Create banner error:", err);
    res.status(400).json({ message: err.message || "Failed to create banner" });
  }
});

// PUT /api/banners/:id (Admin)
router.put("/:id", protect, adminOnly, async (req, res) => {
  try {
    const updated = await Banner.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updated) {
      return res.status(404).json({ message: "Banner not found" });
    }
    await invalidateCache("banners");
    res.json(updated);
  } catch (err) {
    console.error("Update banner error:", err);
    res.status(400).json({ message: err.message || "Failed to update banner" });
  }
});

// DELETE /api/banners/:id (Admin)
router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    const deleted = await Banner.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Banner not found" });
    }
    await invalidateCache("banners");
    res.json({ message: "Banner deleted" });
  } catch (err) {
    console.error("Delete banner error:", err);
    res.status(500).json({ message: "Failed to delete banner" });
  }
});

module.exports = router;
