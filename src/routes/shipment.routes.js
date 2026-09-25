const express = require("express");
const Order = require("../models/Order");
const { createShipment } = require("../services/shiprocket.service");
const { protect } = require("../middleware/auth.middleware");
const { adminOnly } = require("../middleware/admin.middleware");
const { validate } = require("../middleware/validate.middleware");
const {
  shipmentOrderIdParamSchema,
} = require("../validations/shipment.validation");

const router = express.Router();

// Admin — manually trigger Shiprocket shipment creation for an order
router.post(
  "/:orderId/create",
  protect,
  adminOnly,
  validate(shipmentOrderIdParamSchema, "params"),
  async (req, res, next) => {
    try {
      const order = await Order.findById(req.params.orderId);
      if (!order) return res.status(404).json({ message: "Order not found" });

      const result = await createShipment(order);
      if (!order.shipment) order.shipment = {};
      order.shipment.shiprocketOrderId = result.order_id;
      order.status = "shipped";
      order.statusHistory.push({ status: "shipped" });
      await order.save();

      return res.json(order);
    } catch (err) {
      next(err);
    }
  },
);

// Public/customer — tracking status
router.get(
  "/:orderId/track",
  validate(shipmentOrderIdParamSchema, "params"),
  async (req, res, next) => {
    try {
      const order = await Order.findById(req.params.orderId).select(
        "shipment status",
      );
      if (!order) return res.status(404).json({ message: "Order not found" });
      return res.json(order.shipment || {});
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
