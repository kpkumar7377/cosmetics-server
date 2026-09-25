const express = require("express");
const {
  createOrder,
  myOrders,
  allOrders,
  getOrder,
  updateStatus,
  collectCodPayment,
  requestReturn,
  reviewReturn,
  processManualRefund,
  cancelOrder,
  estimateShipping,
} = require("../controllers/order.controller");
const { protect } = require("../middleware/auth.middleware");
const { adminOnly } = require("../middleware/admin.middleware");
const { validate } = require("../middleware/validate.middleware");
const {
  orderIdParamSchema,
  createOrderSchema,
  estimateShippingQuerySchema,
  allOrdersQuerySchema,
  updateOrderStatusSchema,
  cancelOrderSchema,
  requestReturnSchema,
  reviewReturnSchema,
  processRefundSchema,
} = require("../validations/order.validation");

const router = express.Router();

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return next();
  try {
    const jwt = require("jsonwebtoken");
    const User = require("../models/User");
    const decoded = jwt.verify(
      authHeader.split(" ")[1],
      process.env.JWT_SECRET,
    );
    req.user = await User.findById(decoded.id).select("-passwordHash");
  } catch (_) {}
  next();
};

// Shipping estimate route (placed above /:id to prevent route shadowing)
router.get(
  "/estimate-shipping",
  validate(estimateShippingQuerySchema, "query"),
  estimateShipping,
);

router.post(
  "/",
  optionalAuth,
  validate(createOrderSchema, "body"),
  createOrder,
);
router.get("/my", protect, myOrders);
router.get(
  "/",
  protect,
  adminOnly,
  validate(allOrdersQuerySchema, "query"),
  allOrders,
);

// Parameterized order routes
router.get("/:id", protect, validate(orderIdParamSchema, "params"), getOrder);
router.patch(
  "/:id/status",
  protect,
  adminOnly,
  validate(orderIdParamSchema, "params"),
  validate(updateOrderStatusSchema, "body"),
  updateStatus,
);
router.patch(
  "/:id/collect-cod",
  protect,
  adminOnly,
  validate(orderIdParamSchema, "params"),
  collectCodPayment,
);

// Return & Refund Endpoints
router.post(
  "/:id/return-request",
  protect,
  validate(orderIdParamSchema, "params"),
  validate(requestReturnSchema, "body"),
  requestReturn,
);
router.patch(
  "/:id/return-review",
  protect,
  adminOnly,
  validate(orderIdParamSchema, "params"),
  validate(reviewReturnSchema, "body"),
  reviewReturn,
);
router.post(
  "/:id/process-refund",
  protect,
  adminOnly,
  validate(orderIdParamSchema, "params"),
  validate(processRefundSchema, "body"),
  processManualRefund,
);
router.post(
  "/:id/cancel",
  protect,
  validate(orderIdParamSchema, "params"),
  validate(cancelOrderSchema, "body"),
  cancelOrder,
);

module.exports = router;
