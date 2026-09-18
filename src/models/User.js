const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    label: String,
    name: String,
    phone: String,
    line1: String,
    line2: String,
    city: String,
    state: String,
    pincode: String,
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }, // each address gets its own _id automatically — needed to edit/delete/set-default a specific one
);

const bankAccountSchema = new mongoose.Schema(
  {
    accountHolderName: { type: String },
    accountNumber: { type: String },
    ifscCode: { type: String },
    bankName: { type: String },
  },
  { _id: false, timestamps: true },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    // Not required — Google-authenticated users have no local password.
    passwordHash: { type: String },
    phone: String,
    role: { type: String, enum: ["customer", "admin"], default: "customer" },

    // --- Google OAuth (Passport) ---
    googleId: { type: String, index: true, sparse: true },
    authProvider: { type: String, enum: ["local", "google"], default: "local" },
    avatar: String,

    addresses: [addressSchema],

    // Singular name matching user.controller.js (user.bankAccount)
    bankAccount: bankAccountSchema,

    resetPasswordToken: String,
    resetPasswordExpires: Date,
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
