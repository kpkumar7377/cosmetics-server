const express = require("express");
const multer = require("multer");
const { uploadImage } = require("../controllers/upload.controller");
const { protect } = require("../middleware/auth.middleware");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});
const router = express.Router();

// Allow any authenticated user (customer or admin) to upload images
router.post("/", protect, upload.single("image"), uploadImage);

module.exports = router;
