const express = require("express");
const {
  listAddresses,
  addAddress,
  setDefaultAddress,
  deleteAddress,
  getBankAccount,
  saveBankAccount,
  changePassword,
} = require("../controllers/user.controller");
const { protect } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router.get("/addresses", listAddresses);
router.post("/addresses", addAddress);
router.put("/addresses/:addressId/default", setDefaultAddress);
router.delete("/addresses/:addressId", deleteAddress);

// Single refund bank account route
router.get("/bank-account", getBankAccount);
router.put("/bank-account", saveBankAccount);

router.post("/change-password", changePassword);

module.exports = router;
