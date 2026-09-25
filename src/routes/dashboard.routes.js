const express = require("express");
const Order = require("../models/Order");
const Product = require("../models/Product");
const { protect } = require("../middleware/auth.middleware");
const { adminOnly } = require("../middleware/admin.middleware");
const { validate } = require("../middleware/validate.middleware");
const {
  dashboardSummaryQuerySchema,
} = require("../validations/dashboard.validation");

const router = express.Router();

const LOW_STOCK_THRESHOLD = 5;

router.get(
  "/summary",
  protect,
  adminOnly,
  validate(dashboardSummaryQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      const skip = (page - 1) * limit;

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

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

      const [monthlyOrders, totalLowStock, lowStockProducts] =
        await Promise.all([
          Order.find({
            createdAt: { $gte: startOfMonth },
            status: { $ne: "cancelled" },
          }).select("total"),

          Product.countDocuments(lowStockFilter),

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

      return res.json({
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
      next(err);
    }
  },
);

module.exports = router;
