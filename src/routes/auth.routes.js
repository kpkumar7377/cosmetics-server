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

const router = express.Router();

router.post("/register", register);
router.post("/register/send-otp", sendRegistrationOtp);
router.post("/register/verify-otp", verifyRegistrationOtp);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", protect, me);
router.post("/change-password", protect, changePassword);

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
