const streamifier = require("streamifier");
const cloudinary = require("../config/cloudinary");

// POST /api/uploads (admin) — multipart/form-data, field name: "image"
// Used by the admin panel for product images and banner images.
const uploadImage = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No image file provided" });

  const stream = cloudinary.uploader.upload_stream(
    { folder: "cosmetics-store" },
    (error, result) => {
      if (error) return res.status(500).json({ message: "Upload failed", error: error.message });
      res.json({ url: result.secure_url, publicId: result.public_id });
    }
  );

  streamifier.createReadStream(req.file.buffer).pipe(stream);
};

module.exports = { uploadImage };
