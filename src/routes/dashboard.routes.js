const express = require("express");
const Order = require("../models/Order");
const Product = require("../models/Product");
const { protect } = require("../middleware/auth.middleware");
const { adminOnly } = require("../middleware/admin.middleware");

const router = express.Router();

const LOW_STOCK_THRESHOLD = 5;

router.get("/summary", protect, adminOnly, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 5);
    const skip = (page - 1) * limit;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Filter matching both standalone (stock <= 5) and variant products (any variant stock <= 5)
    const lowStockFilter = {
      isActive: true,
      $or: [
        {
          $and: [
            {
              $or: [
                { variants: { $size: 0 } },
                { variants: { $exists: false } },
                { variants: null },
              ],
            },
            {
              $or: [
                { stock: { $lte: LOW_STOCK_THRESHOLD } },
                { stock: { $in: [0, "0", null] } },
              ],
            },
          ],
        },
        {
          variants: {
            $elemMatch: {
              stock: { $lte: LOW_STOCK_THRESHOLD },
            },
          },
        },
      ],
    };

    const [monthlyOrders, totalLowStock, lowStockProducts] = await Promise.all([
      // Gross orders for the current month excluding cancelled
      Order.find({
        createdAt: { $gte: startOfMonth },
        status: { $ne: "cancelled" },
      }).select("total"),

      // Total count of qualifying low stock products for pagination
      Product.countDocuments(lowStockFilter),

      // Paginated low stock products
      Product.find(lowStockFilter)
        .select("name images stock variants basePrice")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const monthlyRevenue = monthlyOrders.reduce(
      (sum, o) => sum + (Number(o.total) || 0),
      0,
    );

    res.json({
      monthlyRevenue,
      monthlyOrderCount: monthlyOrders.length,
      lowStockProducts,
      pagination: {
        total: totalLowStock,
        page,
        limit,
        totalPages: Math.ceil(totalLowStock / limit) || 1,
        hasMore: skip + lowStockProducts.length < totalLowStock,
      },
    });
  } catch (err) {
    console.error("Dashboard summary error:", err);
    res.status(500).json({ message: "Failed to load dashboard metrics" });
  }
});

module.exports = router;
