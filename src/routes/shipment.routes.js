const express = require("express");
const Order = require("../models/Order");
const { createShipment } = require("../services/shiprocket.service");
const { protect } = require("../middleware/auth.middleware");
const { adminOnly } = require("../middleware/admin.middleware");

const router = express.Router();

// Admin — manually trigger Shiprocket shipment creation for an order
router.post("/:orderId/create", protect, adminOnly, async (req, res) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) return res.status(404).json({ message: "Order not found" });

  const result = await createShipment(order);
  order.shipment.shiprocketOrderId = result.order_id;
  order.status = "shipped";
  order.statusHistory.push({ status: "shipped" });
  await order.save();

  res.json(order);
});

// Public/customer — tracking status
router.get("/:orderId/track", async (req, res) => {
  const order = await Order.findById(req.params.orderId).select("shipment status");
  if (!order) return res.status(404).json({ message: "Order not found" });
  res.json(order.shipment);
});

module.exports = router;
