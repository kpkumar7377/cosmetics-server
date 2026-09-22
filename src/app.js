const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const { RedisStore } = require("connect-redis");
const redisClient = require("./config/redis");
const passport = require("./config/passport");

const authRoutes = require("./routes/auth.routes");
const productRoutes = require("./routes/product.routes");
const categoryRoutes = require("./routes/category.routes");
const orderRoutes = require("./routes/order.routes");
const paymentRoutes = require("./routes/payment.routes");
const shipmentRoutes = require("./routes/shipment.routes");
const bannerRoutes = require("./routes/banner.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const uploadRoutes = require("./routes/upload.routes");
const userRoutes = require("./routes/user.routes");
const settingRoutes = require("./routes/setting.routes");
const newsletterRoutes = require("./routes/newsletter.routes");

const { notFound, errorHandler } = require("./middleware/error.middleware");

const app = express();

// Required behind reverse proxies (like Vercel / Cloudflare) so secure cookies work properly
app.set("trust proxy", 1);

app.use(
  cors({
    origin: [process.env.CLIENT_URL, process.env.ADMIN_URL],
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cookieParser());

// Initialize RedisStore backed by your existing Redis client
const redisStore = new RedisStore({
  client: redisClient,
  prefix: "sess:",
});

// Configure session with RedisStore
app.use(
  session({
    store: redisStore,
    secret: process.env.SESSION_SECRET || "cosmetics-store-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.get("/", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/shipments", shipmentRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/users", userRoutes);
app.use("/api/settings", settingRoutes);
app.use("/api/newsletter", newsletterRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
