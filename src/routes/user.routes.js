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
const { validate } = require("../middleware/validate.middleware");
const {
  addressIdParamSchema,
  addAddressSchema,
  bankAccountSchema,
  userChangePasswordSchema,
} = require("../validations/user.validation");

const router = express.Router();

router.use(protect);

router.get("/addresses", listAddresses);
router.post("/addresses", validate(addAddressSchema, "body"), addAddress);
router.put(
  "/addresses/:addressId/default",
  validate(addressIdParamSchema, "params"),
  setDefaultAddress,
);
router.delete(
  "/addresses/:addressId",
  validate(addressIdParamSchema, "params"),
  deleteAddress,
);

// Single refund bank account route
router.get("/bank-account", getBankAccount);
router.put(
  "/bank-account",
  validate(bankAccountSchema, "body"),
  saveBankAccount,
);

router.post(
  "/change-password",
  validate(userChangePasswordSchema, "body"),
  changePassword,
);

module.exports = router;
