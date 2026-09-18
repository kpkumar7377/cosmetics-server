const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "shipping_config",
    },
    standardShippingFee: { type: Number, default: 49 },
    freeShippingThreshold: { type: Number, default: 499 },
    codConvenienceFee: { type: Number, default: 29 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Setting", settingSchema);
