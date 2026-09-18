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
  cancelOrder
} = require("../controllers/order.controller");
const { protect } = require("../middleware/auth.middleware");
const { adminOnly } = require("../middleware/admin.middleware");

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

router.post("/", optionalAuth, createOrder);
router.get("/my", protect, myOrders);
router.get("/", protect, adminOnly, allOrders);
router.get("/:id", protect, getOrder);
router.patch("/:id/status", protect, adminOnly, updateStatus);
router.patch("/:id/collect-cod", protect, adminOnly, collectCodPayment);

// Return & Refund Endpoints
router.post("/:id/return-request", protect, requestReturn);
router.patch("/:id/return-review", protect, adminOnly, reviewReturn);
router.post("/:id/process-refund", protect, adminOnly, processManualRefund);
router.post("/:id/cancel", protect, cancelOrder);

module.exports = router;
