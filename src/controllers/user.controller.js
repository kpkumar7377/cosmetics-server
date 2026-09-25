const bcrypt = require("bcryptjs");
const User = require("../models/User");

// GET /api/users/addresses
const listAddresses = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("addresses");
    return res.json(user?.addresses || []);
  } catch (err) {
    next(err);
  }
};

// POST /api/users/addresses
const addAddress = async (req, res, next) => {
  try {
    const {
      label,
      name,
      phone,
      line1,
      line2,
      city,
      state,
      pincode,
      isDefault,
    } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

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
    return res.status(201).json(user.addresses);
  } catch (err) {
    next(err);
  }
};

// PUT /api/users/addresses/:addressId/default
const setDefaultAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const target = user.addresses.id(req.params.addressId);
    if (!target) return res.status(404).json({ message: "Address not found" });

    user.addresses.forEach((a) => {
      a.isDefault = String(a._id) === String(target._id);
    });

    await user.save();
    return res.json(user.addresses);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/users/addresses/:addressId
const deleteAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const target = user.addresses.id(req.params.addressId);
    if (!target) return res.status(404).json({ message: "Address not found" });

    const wasDefault = target.isDefault;
    target.deleteOne();

    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();
    return res.json(user.addresses);
  } catch (err) {
    next(err);
  }
};

// GET /api/users/bank-account
const getBankAccount = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("bankAccount");
    return res.json(user?.bankAccount || null);
  } catch (err) {
    next(err);
  }
};

// PUT /api/users/bank-account
const saveBankAccount = async (req, res, next) => {
  try {
    const { accountHolderName, accountNumber, ifscCode, bankName } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.bankAccount = {
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
    };

    await user.save();
    return res.json(user.bankAccount);
  } catch (err) {
    next(err);
  }
};

// POST /api/users/change-password
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.authProvider === "google" && !user.passwordHash) {
      return res.status(400).json({
        message:
          "This account signs in with Google and has no password to change",
      });
    }

    const match = await bcrypt.compare(
      currentPassword,
      user.passwordHash || "",
    );
    if (!match) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    return res.json({ message: "Password updated" });
  } catch (err) {
    next(err);
  }
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
