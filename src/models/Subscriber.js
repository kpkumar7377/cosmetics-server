const mongoose = require("mongoose");

const subscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    source: {
      type: String,
      default: "footer_newsletter",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Subscriber", subscriberSchema);
