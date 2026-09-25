const express = require("express");
const passport = require("passport");
const {
  register,
  sendRegistrationOtp,
  verifyRegistrationOtp,
  login,
  me,
  refresh,
  logout,
  changePassword,
  forgotPassword,
  resetPassword,
  googleCallback,
} = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validate.middleware");
const {
  sendRegistrationOtpSchema,
  verifyRegistrationOtpSchema,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} = require("../validations/auth.validation");

const router = express.Router();

router.post("/register", validate(registerSchema), register);
router.post(
  "/register/send-otp",
  validate(sendRegistrationOtpSchema),
  sendRegistrationOtp,
);
router.post(
  "/register/verify-otp",
  validate(verifyRegistrationOtpSchema),
  verifyRegistrationOtp,
);
router.post("/login", validate(loginSchema), login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);
router.get("/me", protect, me);
router.post(
  "/change-password",
  protect,
  validate(changePasswordSchema),
  changePassword,
);

// --- Google OAuth (Passport) ---
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  }),
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/login",
  }),
  googleCallback,
);

module.exports = router;
