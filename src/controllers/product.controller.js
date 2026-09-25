const Product = require("../models/Product");
const Category = require("../models/Category");
const Order = require("../models/Order");
const { invalidateCache } = require("../middleware/cache.middleware");
const {
  releaseExpiredReservations,
  withAvailableStock,
} = require("../services/stockReservation.service");

// Units sold per product, derived from real orders
const getUnitsSoldMap = async () => {
  const rows = await Order.aggregate([
    { $match: { status: { $ne: "cancelled" } } },
    { $unwind: "$items" },
    { $group: { _id: "$items.product", unitsSold: { $sum: "$items.qty" } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.unitsSold]));
};

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
    default:
      return { isFeatured: -1, createdAt: -1 };
  }
};

const sanitizeProductPayload = (body) => {
  // 1. If discount arrived as a JSON string, parse it safely
  let discountObj = body.discount;
  if (typeof discountObj === "string") {
    try {
      discountObj = JSON.parse(discountObj);
    } catch {
      discountObj = {};
    }
  }
  discountObj = discountObj || {};

  const basePrice = Number(body.basePrice);

  // 2. Handle boolean or string "true"/"1"
  const isDiscountActive =
    discountObj.isActive === true ||
    discountObj.isActive === "true" ||
    discountObj.isActive === 1 ||
    discountObj.isActive === "1";

  const percent = Number(discountObj.percent);
  const originalPrice = Number(discountObj.originalPrice || basePrice);

  // 3. Strict validation: percentage must be between 1 and 99
  const hasValidDiscount =
    isDiscountActive && !isNaN(percent) && percent >= 1 && percent <= 99;

  const payload = {
    name: body.name?.trim(),
    slug: body.slug?.trim(),
    description: body.description?.trim() || "",
    category: body.category,
    images: Array.isArray(body.images) ? body.images : [],
    basePrice: isNaN(basePrice) ? 0 : basePrice,
    isActive: body.isActive !== false && body.isActive !== "false",
    isFeatured: body.isFeatured === true || body.isFeatured === "true",
    codEligible: body.codEligible !== false && body.codEligible !== "false",
    discount: {
      isActive: hasValidDiscount,
      percent: hasValidDiscount ? percent : 0,
      originalPrice: hasValidDiscount
        ? !isNaN(originalPrice) && originalPrice > 0
          ? originalPrice
          : basePrice
        : isNaN(basePrice)
          ? 0
          : basePrice,
    },
    variants: Array.isArray(body.variants)
      ? body.variants.map((v) => ({
          sku: v.sku?.trim(),
          label: v.label?.trim(),
          price: Number(v.price) || 0,
          stock: Number(v.stock) || 0,
        }))
      : [],
  };

  if (!payload.variants.length) {
    payload.stock = Number(body.stock) || 0;
  }

  return payload;
};

// GET /api/products (public)
const listProducts = async (req, res, next) => {
  try {
    const { category, search, sale, featured, sort, limit, page } = req.query;
    const filter = { isActive: true };

    if (category) {
      const cat = await Category.findOne({ slug: category });
      filter.category = cat ? cat._id : null;
    }
    if (sale === "true") filter["discount.isActive"] = true;
    if (featured === "true") filter.isFeatured = true;
    if (search) filter.$text = { $search: search };
    if (sort === "newest") {
      filter.createdAt = {
        $gte: new Date(
          Date.now() - NEW_ARRIVAL_WINDOW_DAYS * 24 * 60 * 60 * 1000,
        ),
      };
    }

    const isPaginated = Boolean(page);
    const pageNum = page || 1;
    const pageSize = Math.min(limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const capLimit = !isPaginated ? Math.min(limit || 0, 50) || null : null;

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
    return res.json(products.map(withAvailableStock));
  } catch (error) {
    next(error);
  }
};

// GET /api/products/admin/all (admin)
const listAllProductsAdmin = async (req, res, next) => {
  try {
    const { page, limit, search } = req.query;
    const skip = (page - 1) * limit;

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

    return res.json({
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
    return res
      .status(500)
      .json({ message: "Failed to load admin products catalog" });
  }
};

// GET /api/products/admin/:id (admin)
const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate(
      "category",
      "name slug",
    );
    if (!product) return res.status(404).json({ message: "Product not found" });
    return res.json(product);
  } catch (error) {
    next(error);
  }
};

// GET /api/products/:slug (public)
const getProduct = async (req, res, next) => {
  try {
    await releaseExpiredReservations();

    const product = await Product.findOne({
      slug: req.params.slug,
      isActive: true,
    }).populate("category", "name slug");

    if (!product) return res.status(404).json({ message: "Product not found" });
    return res.json(withAvailableStock(product));
  } catch (error) {
    next(error);
  }
};

// POST /api/products (admin)
const createProduct = async (req, res, next) => {
  try {
    const cleanData = sanitizeProductPayload(req.body);
    const product = await Product.create(cleanData);
    await invalidateCache("products");
    return res.status(201).json(product);
  } catch (error) {
    next(error);
  }
};

// PUT /api/products/:id (admin)
const updateProduct = async (req, res, next) => {
  try {
    const cleanData = sanitizeProductPayload(req.body);

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: cleanData }, // Explicit $set ensures nested discount object persists intact
      {
        new: true,
        runValidators: true,
      },
    );

    if (!product) return res.status(404).json({ message: "Product not found" });

    await invalidateCache("products");
    return res.json(product);
  } catch (error) {
    next(error);
  }
};

// DELETE /api/products/:id (admin)
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    await invalidateCache("products");
    return res.json({ message: "Product deleted" });
  } catch (error) {
    next(error);
  }
};

// GET /api/products/suggest?q=...
const suggestProducts = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);

    const products = await Product.find({
      isActive: true,
      name: { $regex: q, $options: "i" },
    })
      .select("name slug images basePrice discount")
      .limit(6);

    return res.json(products);
  } catch (error) {
    next(error);
  }
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
