const IORedis = require("ioredis");

const getRedisClient = () => {
  // Option 1: Upstash REST Host Parsing
  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    const host = process.env.UPSTASH_REDIS_REST_URL.replace(
      /^https?:\/\//,
      "",
    ).replace(/\/$/, "");

    return new IORedis({
      host,
      port: 6379,
      password: process.env.UPSTASH_REDIS_REST_TOKEN,
      tls: {},
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }

  // Option 2: Parse connection string using WHATWG URL API to prevent [DEP0169]
  const rawUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

  try {
    const parsed = new URL(rawUrl);
    const isTls = parsed.protocol === "rediss:";

    return new IORedis({
      host: parsed.hostname || "127.0.0.1",
      port: Number(parsed.port) || 6379,
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      db:
        parsed.pathname && parsed.pathname.length > 1
          ? Number(parsed.pathname.slice(1))
          : 0,
      tls: isTls ? {} : undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  } catch (e) {
    // Fallback if URL constructor fails
    return new IORedis(rawUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
};

const redis = getRedisClient();

redis.on("connect", () => {
  console.log("[Redis] Connected successfully");
});

redis.on("error", (err) => {
  console.error("[Redis] Error:", err.message);
});

module.exports = redis;
