const express = require("express");
const Subscriber = require("../models/Subscriber");
const { protect } = require("../middleware/auth.middleware");
const { adminOnly } = require("../middleware/admin.middleware");
const { newsletterQueue } = require("../queues/newsletter.queue");
const { validate } = require("../middleware/validate.middleware");
const {
  subscriberIdParamSchema,
  subscribeSchema,
  sendCampaignSchema,
} = require("../validations/newsletter.validation");

const router = express.Router();

// 1. Customer Enrollment: POST /api/newsletter/subscribe
router.post(
  "/subscribe",
  validate(subscribeSchema, "body"),
  async (req, res, next) => {
    try {
      const { email } = req.body;
      const existing = await Subscriber.findOne({ email });

      if (existing) {
        if (!existing.isActive) {
          existing.isActive = true;
          await existing.save();
          return res.json({
            message: "Welcome back! Your subscription is active again.",
          });
        }
        return res
          .status(400)
          .json({ message: "This email is already subscribed." });
      }

      await Subscriber.create({ email });
      return res
        .status(201)
        .json({ message: "Thank you for subscribing to our newsletter!" });
    } catch (err) {
      next(err);
    }
  },
);

// 2. Admin: List all subscribers: GET /api/newsletter/subscribers
router.get("/subscribers", protect, adminOnly, async (req, res, next) => {
  try {
    const subscribers = await Subscriber.find().sort({ createdAt: -1 });
    return res.json(subscribers);
  } catch (err) {
    next(err);
  }
});

// 3. Admin: Delete subscriber: DELETE /api/newsletter/subscribers/:id
router.delete(
  "/subscribers/:id",
  protect,
  adminOnly,
  validate(subscriberIdParamSchema, "params"),
  async (req, res, next) => {
    try {
      const deleted = await Subscriber.findByIdAndDelete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Subscriber not found" });
      }
      return res.json({ message: "Subscriber removed." });
    } catch (err) {
      next(err);
    }
  },
);

// 4. Admin: Queue Promotional Campaign: POST /api/newsletter/send-campaign
router.post(
  "/send-campaign",
  protect,
  adminOnly,
  validate(sendCampaignSchema, "body"),
  async (req, res, next) => {
    try {
      const { subject, htmlContent, recipientEmails } = req.body;

      let targetEmails = recipientEmails;
      if (!targetEmails || !targetEmails.length) {
        const activeSubs = await Subscriber.find({ isActive: true }).select(
          "email",
        );
        targetEmails = activeSubs.map((s) => s.email);
      }

      if (!targetEmails.length) {
        return res
          .status(400)
          .json({ message: "No active subscribers found to send to." });
      }

      // Add jobs to BullMQ
      const jobs = targetEmails.map((email) => ({
        name: "sendPromo",
        data: { email, subject, htmlContent },
        opts: { attempts: 3, backoff: { type: "exponential", delay: 2000 } },
      }));

      await newsletterQueue.addBulk(jobs);

      return res.json({
        message: `Promotional email successfully queued for ${targetEmails.length} recipient(s).`,
        recipientCount: targetEmails.length,
      });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
