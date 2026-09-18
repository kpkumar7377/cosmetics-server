const express = require("express");
const Setting = require("../models/Setting");
const { protect } = require("../middleware/auth.middleware");
const { adminOnly } = require("../middleware/admin.middleware");

const router = express.Router();

// Public route: Customer web app fetches current active shipping rates
router.get("/shipping", async (req, res) => {
  try {
    let config = await Setting.findOne({ key: "shipping_config" });
    if (!config) {
      config = await Setting.create({
        key: "shipping_config",
        standardShippingFee: 49,
        freeShippingThreshold: 499,
        codConvenienceFee: 29,
      });
    }
    res.json({
      standardShippingFee: config.standardShippingFee,
      freeShippingThreshold: config.freeShippingThreshold,
      codConvenienceFee: config.codConvenienceFee,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch shipping settings" });
  }
});

// Admin-only route: Update delivery rates and threshold from Admin Dashboard
router.put("/shipping", protect, adminOnly, async (req, res) => {
  try {
    const { standardShippingFee, freeShippingThreshold, codConvenienceFee } = req.body;

    const config = await Setting.findOneAndUpdate(
      { key: "shipping_config" },
      {
        standardShippingFee: Math.max(0, Number(standardShippingFee) || 0),
        freeShippingThreshold: Math.max(0, Number(freeShippingThreshold) || 0),
        codConvenienceFee: Math.max(0, Number(codConvenienceFee) || 0),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json(config);
  } catch (err) {
    res.status(500).json({ message: "Failed to update shipping settings" });
  }
});

module.exports = router;