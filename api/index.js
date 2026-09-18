require("dotenv").config();
const app = require("../src/app");
const connectDB = require("../src/config/db");
const dns = require("dns");

const PORT = process.env.PORT || 5000;

// Reconnect/reuse DB connection for serverless requests
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("MongoDB connection error:", err);
    return res.status(500).json({ error: "Database connection failed" });
  }
});

// Run local listener only outside production
if (process.env.NODE_ENV !== "production") {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);

  connectDB().then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  });
}

module.exports = app;
