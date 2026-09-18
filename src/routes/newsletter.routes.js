const express = require("express");
const Subscriber = require("../models/Subscriber");
const { protect } = require("../middleware/auth.middleware");
const { adminOnly } = require("../middleware/admin.middleware");
const { newsletterQueue } = require("../queues/newsletter.queue");

const router = express.Router();

// 1. Customer Enrollment: POST /api/newsletter/subscribe
router.post("/subscribe", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes("@")) {
      return res
        .status(400)
        .json({ message: "A valid email address is required." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await Subscriber.findOne({ email: cleanEmail });

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

    await Subscriber.create({ email: cleanEmail });
    res
      .status(201)
      .json({ message: "Thank you for subscribing to our newsletter!" });
  } catch (err) {
    res.status(500).json({ message: "Could not complete enrollment." });
  }
});

// 2. Admin: List all subscribers: GET /api/newsletter/subscribers
router.get("/subscribers", protect, adminOnly, async (req, res) => {
  try {
    const subscribers = await Subscriber.find().sort({ createdAt: -1 });
    res.json(subscribers);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch subscribers." });
  }
});

// 3. Admin: Delete subscriber: DELETE /api/newsletter/subscribers/:id
router.delete("/subscribers/:id", protect, adminOnly, async (req, res) => {
  try {
    await Subscriber.findByIdAndDelete(req.params.id);
    res.json({ message: "Subscriber removed." });
  } catch (err) {
    res.status(500).json({ message: "Failed to remove subscriber." });
  }
});

// 4. Admin: Queue Promotional Campaign: POST /api/newsletter/send-campaign
router.post("/send-campaign", protect, adminOnly, async (req, res) => {
  try {
    const { subject, htmlContent, recipientEmails } = req.body;

    if (!subject || !htmlContent) {
      return res
        .status(400)
        .json({ message: "Subject and email body are required." });
    }

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

    res.json({
      message: `Promotional email successfully queued for ${targetEmails.length} recipient(s).`,
      recipientCount: targetEmails.length,
    });
  } catch (err) {
    console.error("Queue campaign error:", err);
    res.status(500).json({ message: "Failed to dispatch email campaign." });
  }
});

module.exports = router;
