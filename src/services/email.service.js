const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

// 1. Config & Environment Variables
const BRAND_NAME = process.env.BRAND_NAME || "COSMETICS STORE";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@cosmeticsstore.in";
const SITE_URL = process.env.CLIENT_URL || "https://cosmeticsstore.in";

// 2. Clean email parsing to prevent Vercel quote/bracket escaping issues
const rawEmail = process.env.EMAIL_FROM || "info@cosmeticsstore.in";
// Removes quotes, whitespace, and any pre-existing < > brackets
const cleanEmailAddress = rawEmail
  .replace(/['"]+/g, "")
  .replace(/[<>]/g, "")
  .trim();

// Generates valid RFC-compliant format: "COSMETICS STORE <info@cosmeticsstore.in>"
const DEFAULT_SENDER = `${BRAND_NAME} <${cleanEmailAddress}>`;

// ==========================================
// BASE EMAIL SHELL
// ==========================================
const renderEmailShell = ({ title, preheader, bodyContent }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; background-color: #FAF8F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF8F5;">
  <!-- Hidden Preheader -->
  <span style="display: none; font-size: 1px; color: #FAF8F5; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${preheader}
  </span>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FAF8F5; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #FFFFFF; border: 1px solid rgba(212, 175, 55, 0.25); border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(26, 26, 26, 0.04);">
          
          <!-- Top Accent Gold Strip -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, rgba(212,175,55,0.4), #B85D43, rgba(212,175,55,0.4)); font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td align="center" style="padding: 32px 24px 24px; border-bottom: 1px solid rgba(212, 175, 55, 0.15);">
              <a href="${SITE_URL}" style="text-decoration: none; font-family: Georgia, serif; font-size: 20px; letter-spacing: 2px; color: #1A1A1A; font-weight: 600; text-transform: uppercase;">
                ${BRAND_NAME}
              </a>
            </td>
          </tr>

          <!-- Dynamic Body Content -->
          <tr>
            <td style="padding: 32px 28px;">
              ${bodyContent}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #FAF8F5; border-top: 1px solid rgba(212, 175, 55, 0.15); padding: 24px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #B85D43; font-weight: 600;">
                100% Genuine Direct Formulation Guarantee
              </p>
              <p style="margin: 0 0 12px; font-size: 12px; color: #737373; line-height: 1.5;">
                Need help with your purchase? Contact our beauty concierge at
                <a href="mailto:${SUPPORT_EMAIL}" style="color: #1A1A1A; font-weight: 500; text-decoration: underline;">${SUPPORT_EMAIL}</a>.
              </p>
              <p style="margin: 0; font-size: 11px; color: #A3A3A3;">
                &copy; ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ==========================================
// REUSABLE DISPATCH FUNCTION
// ==========================================
const sendEmail = async ({ to, subject, preheader, bodyContent }) => {
  if (!to) {
    console.warn(
      "[Resend] Email dispatch canceled: Missing recipient ('to') address.",
    );
    return null;
  }

  return await resend.emails.send({
    from: DEFAULT_SENDER,
    to,
    subject,
    html: renderEmailShell({
      title: subject,
      preheader: preheader || subject,
      bodyContent,
    }),
  });
};

// ==========================================
// TEMPLATE BUILDERS
// ==========================================

const buildOrderItemsHtml = (items = []) =>
  items
    .map(
      (item) => `
      <tr>
        <td style="padding: 14px 0; border-bottom: 1px solid rgba(212, 175, 55, 0.12); vertical-align: top;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td width="52" style="vertical-align: top; padding-right: 14px;">
                ${
                  item.image
                    ? `<img src="${item.image}" alt="${item.name}" width="52" height="52" style="border-radius: 8px; border: 1px solid rgba(212, 175, 55, 0.2); object-fit: cover; display: block;" />`
                    : `<div style="width: 52px; height: 52px; background-color: #FAF8F5; border: 1px solid rgba(212, 175, 55, 0.2); border-radius: 8px; text-align: center; line-height: 52px; font-size: 10px; color: #737373;">Item</div>`
                }
              </td>
              <td style="vertical-align: middle;">
                <p style="margin: 0 0 3px; font-size: 13px; font-weight: 600; color: #1A1A1A; line-height: 1.4;">
                  ${item.name}
                </p>
                <p style="margin: 0; font-size: 12px; color: #737373;">
                  Qty: ${item.qty} &times; ₹${Number(item.price).toLocaleString("en-IN")}
                </p>
              </td>
              <td align="right" style="vertical-align: middle; white-space: nowrap;">
                <span style="font-family: Georgia, serif; font-size: 13px; font-weight: 600; color: #1A1A1A;">
                  ₹${Number(item.price * item.qty).toLocaleString("en-IN")}
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `,
    )
    .join("");

const templates = {
  orderConfirmation: (order, recipientName, orderDate) => {
    const formattedTotal = Number(order.total || 0).toLocaleString("en-IN");
    const formattedSubtotal = Number(order.subtotal || 0).toLocaleString(
      "en-IN",
    );
    const shippingText =
      order.shippingFee === 0 ? "FREE" : `₹${order.shippingFee}`;

    return `
      <!-- Top Greeting -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
        <tr>
          <td>
            <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #B85D43; display: block; margin-bottom: 4px;">
              Order Confirmed
            </span>
            <h1 style="margin: 0 0 10px; font-family: Georgia, serif; font-size: 22px; color: #1A1A1A; font-weight: normal;">
              Thank you for your order, ${recipientName.split(" ")[0]}!
            </h1>
            <p style="margin: 0; font-size: 13px; color: #525252; line-height: 1.6;">
              We've received your order <strong>#${order.orderNumber}</strong> placed on ${orderDate}. Our fulfillment team is preparing your package for dispatch.
            </p>
          </td>
        </tr>
      </table>

      <!-- Action Link -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 28px;">
        <tr>
          <td align="left">
            <a href="${SITE_URL}/account/orders/${order._id || order.orderNumber}" 
               style="display: inline-block; background-color: #1A1A1A; color: #FAF8F5; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
              View & Track Order &rarr;
            </a>
          </td>
        </tr>
      </table>

      <!-- Itemized Summary -->
      <p style="margin: 0 0 10px; font-family: Georgia, serif; font-size: 15px; color: #1A1A1A; font-weight: 600;">
        Order Summary
      </p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
        ${buildOrderItemsHtml(order.items)}
      </table>

      <!-- Price Breakdown -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 28px; background-color: #FAF8F5; border-radius: 8px; padding: 16px;">
        <tr>
          <td style="font-size: 12px; color: #737373; padding: 3px 0;">Subtotal</td>
          <td align="right" style="font-size: 12px; color: #1A1A1A; font-weight: 500; padding: 3px 0;">₹${formattedSubtotal}</td>
        </tr>
        ${
          order.discountAmount
            ? `<tr>
                <td style="font-size: 12px; color: #047857; padding: 3px 0;">Promotional Discount</td>
                <td align="right" style="font-size: 12px; color: #047857; font-weight: 500; padding: 3px 0;">-₹${Number(order.discountAmount).toLocaleString("en-IN")}</td>
              </tr>`
            : ""
        }
        <tr>
          <td style="font-size: 12px; color: #737373; padding: 3px 0;">Shipping</td>
          <td align="right" style="font-size: 12px; color: #1A1A1A; font-weight: 500; padding: 3px 0;">${shippingText}</td>
        </tr>
        <tr>
          <td style="font-size: 12px; color: #737373; padding: 3px 0;">Payment Method</td>
          <td align="right" style="font-size: 12px; color: #1A1A1A; font-weight: 500; padding: 3px 0; text-transform: uppercase;">${order.payment?.method === "cod" ? "Cash on Delivery" : "Online Payment"}</td>
        </tr>
        <tr>
          <td colspan="2" style="border-top: 1px solid rgba(212, 175, 55, 0.2); padding-top: 10px; margin-top: 6px;"></td>
        </tr>
        <tr>
          <td style="font-family: Georgia, serif; font-size: 14px; font-weight: 600; color: #1A1A1A;">Total Paid</td>
          <td align="right" style="font-family: Georgia, serif; font-size: 16px; font-weight: 600; color: #1A1A1A;">₹${formattedTotal}</td>
        </tr>
      </table>

      <!-- Destination Summary -->
      ${
        order.shippingAddress
          ? `
        <div style="border: 1px solid rgba(212, 175, 55, 0.2); border-radius: 8px; padding: 14px 16px; background-color: #FFFFFF;">
          <p style="margin: 0 0 6px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #B85D43;">
            Shipping Destination
          </p>
          <p style="margin: 0; font-size: 12px; color: #525252; line-height: 1.5;">
            <strong>${order.shippingAddress.name}</strong><br />
            ${order.shippingAddress.line1}${order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""}<br />
            ${order.shippingAddress.city},${order.shippingAddress.state} - ${order.shippingAddress.pincode}<br />${order.shippingAddress.phone ? `Phone: ${order.shippingAddress.phone}` : ""}
          </p>
        </div>`
          : ""
      }
    `;
  },

  passwordReset: (toEmail, resetUrl) => `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
      <tr>
        <td>
          <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #B85D43; display: block; margin-bottom: 4px;">
            Security & Authentication
          </span>
          <h1 style="margin: 0 0 10px; font-family: Georgia, serif; font-size: 22px; color: #1A1A1A; font-weight: normal;">
            Reset Your Password
          </h1>
          <p style="margin: 0; font-size: 13px; color: #525252; line-height: 1.6;">
            We received a request to reset the password associated with your account (<strong>${toEmail}</strong>). Click the button below to choose a new secure password.
          </p>
        </td>
      </tr>
    </table>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0;">
      <tr>
        <td align="center">
          <a href="${resetUrl}" 
             style="display: inline-block; background-color: #1A1A1A; color: #FAF8F5; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.2px;">
            Reset Password &rarr;
          </a>
        </td>
      </tr>
    </table>

    <div style="background-color: #FAF8F5; border-left: 3px solid #B85D43; padding: 12px 14px; border-radius: 4px; margin-bottom: 24px;">
      <p style="margin: 0; font-size: 12px; color: #525252; line-height: 1.5;">
        <strong>Notice:</strong> This password reset link will expire in <strong>1 hour</strong>. If you did not initiate this request, no further action is required and your password remains unchanged.
      </p>
    </div>

    <div style="border-top: 1px solid rgba(212, 175, 55, 0.15); padding-top: 18px;">
      <p style="margin: 0 0 6px; font-size: 11px; color: #737373;">
        Having trouble with the button? Copy and paste this link into your browser:
      </p>
      <p style="margin: 0; word-break: break-all; font-size: 11px; color: #B85D43;">
        <a href="${resetUrl}" style="color: #B85D43; text-decoration: underline;">${resetUrl}</a>
      </p>
    </div>
  `,

  registrationOtp: (firstName, otp) => `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
      <tr>
        <td>
          <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #B85D43; display: block; margin-bottom: 4px;">
            Security & Authentication
          </span>
          <h1 style="margin: 0 0 10px; font-family: Georgia, serif; font-size: 22px; color: #1A1A1A; font-weight: normal;">
            Verify Your Email
          </h1>
          <p style="margin: 0; font-size: 13px; color: #525252; line-height: 1.6;">
            Hello ${firstName}, thank you for registering with ${BRAND_NAME}. Please enter the verification code below to complete your registration.
          </p>
        </td>
      </tr>
    </table>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0;">
      <tr>
        <td align="center">
          <div style="display: inline-block; background-color: #FAF8F5; border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 12px; padding: 18px 36px; text-align: center;">
            <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1A1A1A;">
              ${otp}
            </span>
          </div>
        </td>
      </tr>
    </table>

    <div style="background-color: #FAF8F5; border-left: 3px solid #B85D43; padding: 12px 14px; border-radius: 4px; margin-bottom: 12px;">
      <p style="margin: 0; font-size: 12px; color: #525252; line-height: 1.5;">
        <strong>Notice:</strong> This code is valid for <strong>10 minutes</strong>. Never share this verification code with anyone.
      </p>
    </div>
  `,

  promotional: (htmlContent) => `
    <div style="font-size: 14px; color: #1A1A1A; line-height: 1.7;">
      ${htmlContent}
    </div>
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid rgba(212, 175, 55, 0.2); text-align: center;">
      <p style="font-size: 11px; color: #737373; margin: 0;">
        You are receiving this exclusive announcement because you joined the ${BRAND_NAME} VIP newsletter.
      </p>
    </div>
  `,
};

// ==========================================
// EXPORTED SERVICE FUNCTIONS
// ==========================================

const sendOrderConfirmation = async (order) => {
  const to = order.user?.email || order.guestInfo?.email;
  if (!to) return;

  const recipientName =
    order.user?.name ||
    order.guestInfo?.name ||
    order.shippingAddress?.name ||
    "Beauty Enthusiast";

  const orderDate = new Date(order.createdAt || Date.now()).toLocaleDateString(
    "en-IN",
    {
      month: "long",
      day: "numeric",
      year: "numeric",
    },
  );

  const bodyContent = templates.orderConfirmation(
    order,
    recipientName,
    orderDate,
  );

  return await sendEmail({
    to,
    subject: `Order Confirmed — #${order.orderNumber}`,
    preheader: `Thank you for your order #${order.orderNumber}. We're preparing your package for dispatch.`,
    bodyContent,
  });
};

const sendPasswordReset = async (toEmail, resetUrl) => {
  const bodyContent = templates.passwordReset(toEmail, resetUrl);

  return await sendEmail({
    to: toEmail,
    subject: "Reset your password",
    preheader: "Reset your account password. This link expires in 1 hour.",
    bodyContent,
  });
};

const sendRegistrationOtpEmail = async (toEmail, name, otp) => {
  const firstName = name ? name.split(" ")[0] : "Beauty Enthusiast";
  const bodyContent = templates.registrationOtp(firstName, otp);

  return await sendEmail({
    to: toEmail,
    subject: `Your Verification Code: ${otp}`,
    preheader: `Your verification code is ${otp}. It expires in 10 minutes.`,
    bodyContent,
  });
};

const sendPromotionalEmail = async ({ to, subject, htmlContent }) => {
  const bodyContent = templates.promotional(htmlContent);

  return await sendEmail({
    to,
    subject,
    preheader: subject,
    bodyContent,
  });
};

module.exports = {
  sendOrderConfirmation,
  sendPasswordReset,
  sendPromotionalEmail,
  sendRegistrationOtpEmail,
};
