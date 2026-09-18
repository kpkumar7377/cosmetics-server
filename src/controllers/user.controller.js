const bcrypt = require("bcryptjs");
const User = require("../models/User");

// GET /api/users/addresses
const listAddresses = async (req, res) => {
  const user = await User.findById(req.user.id).select("addresses");
  res.json(user.addresses);
};

// POST /api/users/addresses
const addAddress = async (req, res) => {
  const { label, name, phone, line1, line2, city, state, pincode, isDefault } =
    req.body;
  if (!name || !phone || !line1 || !city || !state || !pincode) {
    return res.status(400).json({
      message:
        "Name, phone, address line 1, city, state and pincode are required",
    });
  }

  const user = await User.findById(req.user.id);
  const shouldBeDefault = isDefault || user.addresses.length === 0;
  if (shouldBeDefault) {
    user.addresses.forEach((a) => {
      a.isDefault = false;
    });
  }

  user.addresses.push({
    label,
    name,
    phone,
    line1,
    line2,
    city,
    state,
    pincode,
    isDefault: shouldBeDefault,
  });
  await user.save();
  res.status(201).json(user.addresses);
};

// PUT /api/users/addresses/:addressId/default
const setDefaultAddress = async (req, res) => {
  const user = await User.findById(req.user.id);
  const target = user.addresses.id(req.params.addressId);
  if (!target) return res.status(404).json({ message: "Address not found" });

  user.addresses.forEach((a) => {
    a.isDefault = String(a._id) === String(target._id);
  });
  await user.save();
  res.json(user.addresses);
};

// DELETE /api/users/addresses/:addressId
const deleteAddress = async (req, res) => {
  const user = await User.findById(req.user.id);
  const target = user.addresses.id(req.params.addressId);
  if (!target) return res.status(404).json({ message: "Address not found" });

  const wasDefault = target.isDefault;
  target.deleteOne();

  if (wasDefault && user.addresses.length > 0) {
    user.addresses[0].isDefault = true;
  }

  await user.save();
  res.json(user.addresses);
};

// GET /api/users/bank-account
const getBankAccount = async (req, res) => {
  const user = await User.findById(req.user.id).select("bankAccount");
  res.json(user.bankAccount || null);
};

// PUT /api/users/bank-account (Adds if absent, updates if already existing)
const saveBankAccount = async (req, res) => {
  const { accountHolderName, accountNumber, ifscCode, bankName } = req.body;

  if (!accountHolderName || !accountNumber || !ifscCode) {
    return res.status(400).json({
      message:
        "Account holder name, account number, and IFSC code are required",
    });
  }

  const user = await User.findById(req.user.id);
  user.bankAccount = {
    accountHolderName,
    accountNumber,
    ifscCode: ifscCode.toUpperCase().trim(),
    bankName: bankName || "",
  };

  await user.save();
  res.json(user.bankAccount);
};

// PUT /api/users/change-password
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res
      .status(400)
      .json({ message: "New password must be at least 6 characters" });
  }

  const user = await User.findById(req.user.id);

  if (user.authProvider === "google" && !user.passwordHash) {
    return res.status(400).json({
      message:
        "This account signs in with Google and has no password to change",
    });
  }

  const match = await bcrypt.compare(
    currentPassword || "",
    user.passwordHash || "",
  );
  if (!match)
    return res.status(401).json({ message: "Current password is incorrect" });

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();
  res.json({ message: "Password updated" });
};

module.exports = {
  listAddresses,
  addAddress,
  setDefaultAddress,
  deleteAddress,
  getBankAccount,
  saveBankAccount,
  changePassword,
};
