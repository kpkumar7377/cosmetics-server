const axios = require("axios");

const SHIPROCKET_BASE = "https://apiv2.shiprocket.in/v1/external";
let cachedToken = null;

const getToken = async () => {
  if (cachedToken) return cachedToken;
  const { data } = await axios.post(`${SHIPROCKET_BASE}/auth/login`, {
    email: process.env.SHIPROCKET_EMAIL,
    password: process.env.SHIPROCKET_PASSWORD,
  });
  cachedToken = data.token;
  return cachedToken;
};

const createShipment = async (order) => {
  const token = await getToken();
  const { data } = await axios.post(
    `${SHIPROCKET_BASE}/orders/create/adhoc`,
    {
      order_id: order.orderNumber,
      order_date: order.createdAt,
      billing_customer_name: order.shippingAddress.name,
      billing_address: order.shippingAddress.line1,
      billing_city: order.shippingAddress.city,
      billing_state: order.shippingAddress.state,
      billing_pincode: order.shippingAddress.pincode,
      billing_phone: order.shippingAddress.phone,
      order_items: order.items.map((i) => ({
        name: i.name,
        sku: i.variantSku,
        units: i.qty,
        selling_price: i.price,
      })),
      payment_method: order.payment.status === "paid" ? "Prepaid" : "COD",
      sub_total: order.subtotal,
    },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return data; // includes shipment_id / awb details depending on plan
};

const createReversePickup = async (order) => {
  const token = await getToken();
  const { data } = await axios.post(
    `${SHIPROCKET_BASE}/orders/create/return`,
    {
      order_id: `${order.orderNumber}-RET`,
      order_date: new Date().toISOString(),
      channel_id: "",
      pickup_customer_name: order.shippingAddress.name,
      pickup_address: order.shippingAddress.line1,
      pickup_address_2: order.shippingAddress.line2 || "",
      pickup_city: order.shippingAddress.city,
      pickup_state: order.shippingAddress.state,
      pickup_pincode: order.shippingAddress.pincode,
      pickup_phone: order.shippingAddress.phone,
      order_items: order.items.map((i) => ({
        name: i.name,
        sku: i.variantSku || "DEFAULT",
        units: i.qty,
        selling_price: i.price,
      })),
      sub_total: order.subtotal,
    },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return data;
};

const cancelShipment = async (awbCodeOrOrderId) => {
  try {
    const token = await getToken();
    const { data } = await axios.post(
      `${SHIPROCKET_BASE}/orders/cancel`,
      { ids: [awbCodeOrOrderId] },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return data;
  } catch (err) {
    console.error("Shiprocket cancel error:", err.response?.data || err.message);
    return null;
  }
};

module.exports = { createShipment, createReversePickup, cancelShipment };