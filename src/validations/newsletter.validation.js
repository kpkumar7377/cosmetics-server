const { z } = require("zod");

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const subscriberIdParamSchema = z.object({
  id: z
    .string({ required_error: "Subscriber ID is required" })
    .trim()
    .regex(objectIdRegex, "Invalid Subscriber ID format"),
});

const subscribeSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .trim()
    .toLowerCase()
    .email("A valid email address is required"),
});

const sendCampaignSchema = z.object({
  subject: z
    .string({ required_error: "Subject is required" })
    .trim()
    .min(3, "Subject must be at least 3 characters")
    .max(200, "Subject cannot exceed 200 characters"),
  htmlContent: z
    .string({ required_error: "Email content is required" })
    .trim()
    .min(10, "Email body must be at least 10 characters"),
  recipientEmails: z
    .array(z.string().trim().toLowerCase().email("Invalid recipient email"))
    .optional()
    .default([]),
});

module.exports = {
  subscriberIdParamSchema,
  subscribeSchema,
  sendCampaignSchema,
};
