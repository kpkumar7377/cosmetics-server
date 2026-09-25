const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const redisClient = require("../config/redis");
const User = require("../models/User");
const {
  sendPasswordReset,
  sendRegistrationOtpEmail,
} = require("../services/email.service");

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
  });

const signRefreshToken = (user) =>
  jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  });

const setRefreshCookie = (res, refreshToken) => {
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const sanitize = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  authProvider: user.authProvider,
});

// POST /api/auth/register/send-otp
const sendRegistrationOtp = async (req, res, next) => {
  try {
    const { email, name, password, phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const otp = generateOTP();
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp, salt);
    const passwordHash = await bcrypt.hash(password, salt);

    // Cache payload and hashed OTP in Redis for 10 minutes (600 seconds)
    const redisKey = `registration_otp:${email}`;
    const payload = JSON.stringify({
      name,
      email,
      phone: phone || "",
      passwordHash,
      hashedOtp,
    });

    await redisClient.set(redisKey, payload, "EX", 600);
    await sendRegistrationOtpEmail(email, name, otp);

    return res.status(200).json({
      success: true,
      message: "Verification OTP has been sent to your email.",
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/register/verify-otp
const verifyRegistrationOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const redisKey = `registration_otp:${email}`;
    const cachedData = await redisClient.get(redisKey);

    if (!cachedData) {
      return res.status(400).json({
        success: false,
        message:
          "Verification code expired or not found. Please request a new one.",
      });
    }

    const parsedData = JSON.parse(cachedData);
    const isMatch = await bcrypt.compare(otp, parsedData.hashedOtp);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code.",
      });
    }

    const alreadyExists = await User.findOne({ email });
    if (alreadyExists) {
      await redisClient.del(redisKey);
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const newUser = await User.create({
      name: parsedData.name,
      email: parsedData.email,
      phone: parsedData.phone,
      passwordHash: parsedData.passwordHash,
      authProvider: "local",
      isVerified: true,
    });

    await redisClient.del(redisKey);
    setRefreshCookie(res, signRefreshToken(newUser));

    return res.status(201).json({
      success: true,
      message: "Account verified and registered successfully.",
      user: sanitize(newUser),
      token: signToken(newUser),
    });
  } catch (error) {
    next(error);
  }
};

// Legacy Direct Register
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      passwordHash,
      authProvider: "local",
    });

    setRefreshCookie(res, signRefreshToken(user));
    return res
      .status(201)
      .json({ token: signToken(user), user: sanitize(user) });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
    const adminPass = process.env.ADMIN_PASS;

    if (
      adminEmail &&
      adminPass &&
      email === adminEmail &&
      password === adminPass
    ) {
      let adminUser = await User.findOne({ email: adminEmail });

      if (!adminUser) {
        adminUser = await User.create({
          name: "Admin",
          email: adminEmail,
          passwordHash: await bcrypt.hash(adminPass, 10),
          role: "admin",
          authProvider: "local",
        });
      } else if (adminUser.role !== "admin") {
        adminUser.role = "admin";
        await adminUser.save();
      }

      setRefreshCookie(res, signRefreshToken(adminUser));
      return res.json({
        token: signToken(adminUser),
        user: sanitize(adminUser),
      });
    }

    const user = await User.findOne({ email });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    setRefreshCookie(res, signRefreshToken(user));
    return res.json({ token: signToken(user), user: sanitize(user) });
  } catch (error) {
    next(error);
  }
};

// GET /api/auth/me
const me = async (req, res) => {
  res.json({ user: sanitize(req.user) });
};

// POST /api/auth/refresh
const refresh = async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ message: "No refresh token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: "User not found" });

    res.json({ token: signToken(user), user: sanitize(user) });
  } catch (err) {
    return res
      .status(401)
      .json({ message: "Invalid or expired refresh token" });
  }
};

// POST /api/auth/logout
const logout = async (req, res) => {
  res.clearCookie("refreshToken");
  res.json({ message: "Logged out" });
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (user && user.authProvider === "google") {
      return res.status(400).json({
        code: "AUTH_PROVIDER_GOOGLE",
        message:
          "This account was created with Google. Please sign in using Google.",
      });
    }

    if (!user) {
      return res.json({
        message: "If that email is registered, a reset link has been sent.",
      });
    }

    const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000;
    await user.save();

    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
    await sendPasswordReset(user.email, resetUrl);

    return res.json({
      message: "If that email is registered, a reset link has been sent.",
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({
      _id: decoded.id,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user) {
      return res
        .status(400)
        .json({ message: "Reset link is invalid or has expired" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Password updated — you can now log in." });
  } catch (err) {
    return res
      .status(400)
      .json({ message: "Reset link is invalid or has expired" });
  }
};

// GET /api/auth/google/callback
const googleCallback = (req, res) => {
  const user = req.user;
  setRefreshCookie(res, signRefreshToken(user));
  const token = signToken(user);
  res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
};

// POST /api/auth/change-password
const changePassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Password updated successfully." });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendRegistrationOtp,
  verifyRegistrationOtp,
  register,
  login,
  me,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  googleCallback,
  changePassword,
};
