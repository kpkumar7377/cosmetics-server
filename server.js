require("dotenv").config();
const dns = require("dns");

// Force Node.js to use Google DNS for SRV record lookups
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const app = require("./src/app");
const connectDB = require("./src/config/db");

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
