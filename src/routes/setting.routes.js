const express = require("express");
const Setting = require("../models/Setting");
const { protect } = require("../middleware/auth.middleware");
const { adminOnly } = require("../middleware/admin.middleware");
const { validate } = require("../middleware/validate.middleware");
const {
  updateShippingConfigSchema,
} = require("../validations/setting.validation");

const router = express.Router();

// Public route: Customer web app fetches current active shipping rates
router.get("/shipping", async (req, res, next) => {
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
    return res.json({
      standardShippingFee: config.standardShippingFee,
      freeShippingThreshold: config.freeShippingThreshold,
      codConvenienceFee: config.codConvenienceFee,
    });
  } catch (err) {
    next(err);
  }
});

// Admin-only route: Update delivery rates and threshold from Admin Dashboard
router.put(
  "/shipping",
  protect,
  adminOnly,
  validate(updateShippingConfigSchema, "body"),
  async (req, res, next) => {
    try {
      const { standardShippingFee, freeShippingThreshold, codConvenienceFee } =
        req.body;

      const config = await Setting.findOneAndUpdate(
        { key: "shipping_config" },
        {
          standardShippingFee,
          freeShippingThreshold,
          codConvenienceFee,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      return res.json(config);
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
