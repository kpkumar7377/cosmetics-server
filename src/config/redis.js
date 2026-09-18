const IORedis = require("ioredis");

const getRedisClient = () => {
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

  return new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
    maxRetriesPerRequest: null,
  });
};

const redis = getRedisClient();

redis.on("connect", () => {
  console.log("[Redis] Connected successfully");
});

redis.on("error", (err) => {
  console.error("[Redis] Error:", err.message);
});

module.exports = redis;
