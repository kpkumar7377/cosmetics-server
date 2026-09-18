const redis = require("../config/redis");

/**
 * Route-level cache middleware
 * @param {string} prefix - Group identifier (e.g. 'products', 'categories')
 * @param {number} ttl - Expiry in seconds (default: 1800s / 30m)
 */
const cacheMiddleware =
  (prefix, ttl = 1800) =>
  async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== "GET") return next();

    const cacheKey = `cache:${prefix}:${req.originalUrl}`;

    try {
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        return res.status(200).json(JSON.parse(cachedData));
      }

      // Intercept res.json to populate cache before sending
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        // Only cache successful 200 responses
        if (res.statusCode === 200) {
          redis.setex(cacheKey, ttl, JSON.stringify(body)).catch((err) => {
            console.error("[Redis] setex failed:", err.message);
          });
        }
        return originalJson(body);
      };

      next();
    } catch (err) {
      console.error(
        "[Redis] Cache read error, falling back to DB:",
        err.message,
      );
      next();
    }
  };

/**
 * Invalidate all keys under a given prefix
 * @param {string} prefix - Group identifier to purge
 */
const invalidateCache = async (prefix) => {
  try {
    const pattern = `cache:${prefix}:*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(keys);
    }
  } catch (err) {
    console.error(`[Redis] Invalidation error for ${prefix}:`, err.message);
  }
};

module.exports = { cacheMiddleware, invalidateCache };
