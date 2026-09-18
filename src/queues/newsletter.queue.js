const { Queue, Worker } = require("bullmq");
const redis = require("../config/redis");
const { sendPromotionalEmail } = require("../services/email.service");

// BullMQ uses duplicate connections to manage blocking commands
const connection = redis.duplicate();

const newsletterQueue = new Queue("newsletterQueue", { connection });

const newsletterWorker = new Worker(
  "newsletterQueue",
  async (job) => {
    const { email, subject, htmlContent } = job.data;
    await sendPromotionalEmail({ to: email, subject, htmlContent });
  },
  {
    connection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000,
    },
  },
);

newsletterWorker.on("completed", (job) => {
  console.log(`[BullMQ] Sent promotional email to ${job.data.email}`);
});

newsletterWorker.on("failed", (job, err) => {
  console.error(`[BullMQ] Failed sending to ${job.data.email}:`, err.message);
});

module.exports = { newsletterQueue };
