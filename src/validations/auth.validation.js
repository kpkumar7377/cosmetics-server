const { z } = require("zod");

const emailSchema = z
  .string({ required_error: "Email is required" })
  .trim()
  .toLowerCase()
  .email("Please provide a valid email address");

const passwordSchema = z
  .string({ required_error: "Password is required" })
  .min(8, "Password must be at least 8 characters long")
  .max(128, "Password cannot exceed 128 characters");

const sendRegistrationOtpSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters long")
    .max(100, "Name cannot exceed 100 characters"),
  email: emailSchema,
  password: passwordSchema,
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{7,20}$/, "Invalid phone number format")
    .optional()
    .or(z.literal("")),
});

const verifyRegistrationOtpSchema = z.object({
  email: emailSchema,
  otp: z
    .string({ required_error: "Verification code is required" })
    .trim()
    .length(6, "OTP must be exactly 6 digits"),
});

const registerSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name cannot exceed 100 characters"),
  email: emailSchema,
  password: passwordSchema,
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ required_error: "Password is required" }),
});

const forgotPasswordSchema = z.object({
  email: emailSchema,
});

const resetPasswordSchema = z.object({
  token: z
    .string({ required_error: "Token is required" })
    .trim()
    .min(1, "Token is required"),
  newPassword: passwordSchema,
});

const changePasswordSchema = z.object({
  newPassword: passwordSchema,
});

module.exports = {
  sendRegistrationOtpSchema,
  verifyRegistrationOtpSchema,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
};
