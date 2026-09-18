const mongoose = require("mongoose");

let isConnected = false;

const connectDB = async () => {
  // Return existing active connection if already connected (readyState 1)
  if (mongoose.connection.readyState === 1) {
    return;
  }

  // If already connecting (readyState 2), wait for it
  if (mongoose.connection.readyState === 2) {
    await new Promise((resolve) => {
      mongoose.connection.once("connected", resolve);
    });
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      bufferCommands: false, // Prevents queries from queuing/hanging for 10s if DB is down
    });
    isConnected = true;
    console.log("MongoDB connected:", conn.connection.host);
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    // Throw error so the Express middleware catches it and returns a 500 JSON response
    throw err;
  }
};

module.exports = connectDB;
