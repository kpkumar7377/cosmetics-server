require("dotenv").config();
const app = require("../src/app");
const connectDB = require("../src/config/db");
const dns = require("dns");

const PORT = process.env.PORT || 5000;

// Local development setup
if (process.env.NODE_ENV !== "production") {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);

  connectDB().then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  });
}

// Serverless entry point for Vercel
module.exports = async (req, res) => {
  try {
    await connectDB();
  } catch (err) {
    console.error("MongoDB connection error:", err);
    return res.status(500).json({ error: "Database connection failed", message: err.message });
  }

  return app(req, res);
};