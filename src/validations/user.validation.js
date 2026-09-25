const { z } = require("zod");

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const addressIdParamSchema = z.object({
  addressId: z
    .string({ required_error: "Address ID is required" })
    .trim()
    .regex(objectIdRegex, "Invalid Address ID format"),
});

const addAddressSchema = z.object({
  label: z
    .string()
    .trim()
    .max(50, "Label cannot exceed 50 characters")
    .optional()
    .default("Home"),
  name: z
    .string({ required_error: "Recipient name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name cannot exceed 100 characters"),
  phone: z
    .string({ required_error: "Phone number is required" })
    .trim()
    .regex(/^[0-9+\-\s()]{7,20}$/, "Invalid phone number format"),
  line1: z
    .string({ required_error: "Address line 1 is required" })
    .trim()
    .min(3, "Address line 1 is required"),
  line2: z.string().trim().optional().default(""),
  city: z
    .string({ required_error: "City is required" })
    .trim()
    .min(2, "City is required"),
  state: z
    .string({ required_error: "State is required" })
    .trim()
    .min(2, "State is required"),
  pincode: z
    .string({ required_error: "Pincode is required" })
    .trim()
    .regex(/^[0-9]{4,10}$/, "Invalid postal pincode"),
  isDefault: z.boolean().optional().default(false),
});

const bankAccountSchema = z.object({
  accountHolderName: z
    .string({ required_error: "Account holder name is required" })
    .trim()
    .min(2, "Account holder name must be at least 2 characters")
    .max(100, "Account holder name cannot exceed 100 characters"),
  accountNumber: z
    .string({ required_error: "Account number is required" })
    .trim()
    .min(6, "Account number must be at least 6 digits")
    .max(30, "Account number cannot exceed 30 digits"),
  ifscCode: z
    .string({ required_error: "IFSC code is required" })
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z]{4}0[A-Z0-9]{6}$/,
      "Invalid Indian IFSC format (e.g. HDFC0001234)",
    ),
  bankName: z
    .string()
    .trim()
    .max(100, "Bank name cannot exceed 100 characters")
    .optional()
    .default(""),
});

const userChangePasswordSchema = z.object({
  currentPassword: z.string({ required_error: "Current password is required" }),
  newPassword: z
    .string({ required_error: "New password is required" })
    .min(8, "New password must be at least 8 characters long")
    .max(128, "New password cannot exceed 128 characters"),
});

module.exports = {
  addressIdParamSchema,
  addAddressSchema,
  bankAccountSchema,
  userChangePasswordSchema,
};
