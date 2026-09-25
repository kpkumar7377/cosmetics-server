const express = require("express");
const multer = require("multer");
const { uploadImage } = require("../controllers/upload.controller");
const { protect } = require("../middleware/auth.middleware");
const {
  validateUploadedFile,
} = require("../middleware/uploadValidation.middleware");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = express.Router();

// Authenticated image uploads with file validation
router.post(
  "/",
  protect,
  upload.single("image"),
  validateUploadedFile,
  uploadImage,
);

module.exports = router;
