const Product = require("../models/Product");
const Category = require("../models/Category");
const Order = require("../models/Order");
const { invalidateCache } = require("../middleware/cache.middleware");
const {
  releaseExpiredReservations,
  withAvailableStock,
} = require("../services/stockReservation.service");

// Units sold per product, derived from real orders (no soldCount field on
// Product — this is the source of truth). Cancelled orders don't count.
const getUnitsSoldMap = async () => {
  const rows = await Order.aggregate([
    { $match: { status: { $ne: "cancelled" } } },
    { $unwind: "$items" },
    { $group: { _id: "$items.product", unitsSold: { $sum: "$items.qty" } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.unitsSold]));
};

// "New Arrivals" window — products uploaded within this many days count as new.
const NEW_ARRIVAL_WINDOW_DAYS = parseInt(
  process.env.NEW_ARRIVAL_WINDOW_DAYS || "10",
  10,
);
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 20;

const buildSortStage = (sort) => {
  switch (sort) {
    case "priceLow":
      return { basePrice: 1 };
    case "priceHigh":
      return { basePrice: -1 };
    case "name":
      return { name: 1 };
    case "newest":
      return { createdAt: -1 };
    default: // "featured" or unspecified
      return { isFeatured: -1, createdAt: -1 };
  }
};

const normalizeStock = (body) => {
  if (body.variants?.length) {
    body.stock = 0;
  } else {
    body.stock = Number(body.stock) || 0;
  }
  return body;
};

// GET /api/products (public) — only active products
const listProducts = async (req, res) => {
  const { category, search, sale, featured, sort, limit, page } = req.query;
  const filter = { isActive: true };

  if (category) {
    const cat = await Category.findOne({ slug: category });
    filter.category = cat ? cat._id : null;
  }
  if (sale) filter["discount.isActive"] = true;
  if (featured) filter.isFeatured = true;
  if (search) filter.$text = { $search: search };
  if (sort === "newest") {
    filter.createdAt = {
      $gte: new Date(
        Date.now() - NEW_ARRIVAL_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      ),
    };
  }

  const isPaginated = Boolean(page);
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const pageSize = Math.min(
    parseInt(limit, 10) || DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );
  const capLimit = !isPaginated
    ? Math.min(parseInt(limit, 10) || 0, 50) || null
    : null;

  if (sort === "bestseller") {
    const soldMap = await getUnitsSoldMap();
    const soldIds = [...soldMap.keys()];
    const products = await Product.find({ ...filter, _id: { $in: soldIds } })
      .populate("category", "name slug")
      .lean();

    const ranked = products
      .map((p) => ({ ...p, unitsSold: soldMap.get(String(p._id)) || 0 }))
      .sort((a, b) => b.unitsSold - a.unitsSold);

    if (isPaginated) {
      const skip = (pageNum - 1) * pageSize;
      return res.json({
        products: ranked.slice(skip, skip + pageSize).map(withAvailableStock),
        page: pageNum,
        pageSize,
        total: ranked.length,
        hasMore: skip + pageSize < ranked.length,
      });
    }
    return res.json(
      (capLimit ? ranked.slice(0, capLimit) : ranked).map(withAvailableStock),
    );
  }

  if (isPaginated) {
    const skip = (pageNum - 1) * pageSize;
    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("category", "name slug")
        .sort(buildSortStage(sort))
        .skip(skip)
        .limit(pageSize),
      Product.countDocuments(filter),
    ]);
    return res.json({
      products: products.map(withAvailableStock),
      page: pageNum,
      pageSize,
      total,
      hasMore: skip + products.length < total,
    });
  }

  let query = Product.find(filter).populate("category", "name slug");
  if (sort === "newest") query = query.sort({ createdAt: -1 });
  if (capLimit) query = query.limit(capLimit);

  const products = await query;
  res.json(products.map(withAvailableStock));
};

// GET /api/products/admin/all (admin) — includes inactive/out-of-stock products
const listAllProductsAdmin = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
    const skip = (page - 1) * limit;
    const search = req.query.search ? req.query.search.trim() : "";

    const filter = {};
    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { name: searchRegex },
        { "variants.label": searchRegex },
        { "variants.sku": searchRegex },
      ];
    }

    const [total, products] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .populate("category", "name slug")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    res.json({
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore: skip + products.length < total,
      },
    });
  } catch (err) {
    console.error("Admin products fetch error:", err);
    res.status(500).json({ message: "Failed to load admin products catalog" });
  }
};

// GET /api/products/admin/:id (admin — raw doc)
const getProductById = async (req, res) => {
  const product = await Product.findById(req.params.id).populate(
    "category",
    "name slug",
  );
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json(product);
};

// GET /api/products/:slug (public — storefront)
const getProduct = async (req, res) => {
  await releaseExpiredReservations();

  const product = await Product.findOne({
    slug: req.params.slug,
    isActive: true,
  }).populate("category", "name slug");
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json(withAvailableStock(product));
};

// POST /api/products (admin)
const createProduct = async (req, res) => {
  const product = await Product.create(normalizeStock(req.body));
  await invalidateCache("products");
  res.status(201).json(product);
};

// PUT /api/products/:id (admin)
const updateProduct = async (req, res) => {
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    normalizeStock(req.body),
    { new: true },
  );
  if (!product) return res.status(404).json({ message: "Product not found" });
  await invalidateCache("products");
  res.json(product);
};

// DELETE /api/products/:id (admin)
const deleteProduct = async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });
  await invalidateCache("products");
  res.json({ message: "Product deleted" });
};

// GET /api/products/suggest?q=...
const suggestProducts = async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.json([]);

  const products = await Product.find({
    isActive: true,
    name: { $regex: q, $options: "i" },
  })
    .select("name slug images basePrice discount")
    .limit(6);

  res.json(products);
};

module.exports = {
  listProducts,
  listAllProductsAdmin,
  getProductById,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  suggestProducts,
};
