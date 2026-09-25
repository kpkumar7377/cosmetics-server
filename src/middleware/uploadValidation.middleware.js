const { z } = require("zod");

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const fileSchema = z.object({
  fieldname: z.string(),
  originalname: z.string().trim().min(1, "File must have an original name"),
  mimetype: z.string().refine((type) => ALLOWED_MIME_TYPES.includes(type), {
    message:
      "Unsupported file type. Only JPEG, PNG, and WebP images are allowed.",
  }),
  size: z
    .number()
    .max(MAX_FILE_SIZE, "File size exceeds the 10MB upload limit"),
});

const validateUploadedFile = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "No image file provided for upload.",
    });
  }

  const result = fileSchema.safeParse(req.file);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.error.errors[0]?.message || "Invalid file uploaded.",
    });
  }

  next();
};

module.exports = { validateUploadedFile };
