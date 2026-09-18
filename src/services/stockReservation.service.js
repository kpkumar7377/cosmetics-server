const Order = require("../models/Order");
const Product = require("../models/Product");
const { invalidateCache } = require("../middleware/cache.middleware");

// How long a Razorpay checkout attempt holds stock before it's released
// back to the pool if payment never completes.
const RESERVATION_MINUTES = 10;
const reservationDeadline = () =>
  new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000);

/**
 * Atomically reserves stock only if available inventory is sufficient.
 * Automatically rolls back previous items if any item in the cart fails.
 */
const reserveStock = async (items) => {
  const reservedItems = [];

  try {
    for (const item of items) {
      let updated;

      if (item.variantSku) {
        // Guarded atomic check for variant: stock - reservedStock >= qty
        updated = await Product.findOneAndUpdate(
          {
            _id: item.productId,
            "variants.sku": item.variantSku,
            $expr: {
              $gte: [
                {
                  $subtract: [
                    {
                      $arrayElemAt: [
                        "$variants.stock",
                        {
                          $indexOfArray: ["$variants.sku", item.variantSku],
                        },
                      ],
                    },
                    {
                      $ifNull: [
                        {
                          $arrayElemAt: [
                            "$variants.reservedStock",
                            {
                              $indexOfArray: ["$variants.sku", item.variantSku],
                            },
                          ],
                        },
                        0,
                      ],
                    },
                  ],
                },
                item.qty,
              ],
            },
          },
          { $inc: { "variants.$.reservedStock": item.qty } },
          { new: true },
        );
      } else {
        // Guarded atomic check for standard product
        updated = await Product.findOneAndUpdate(
          {
            _id: item.productId,
            variants: { $size: 0 },
            $expr: {
              $gte: [
                { $subtract: ["$stock", { $ifNull: ["$reservedStock", 0] }] },
                item.qty,
              ],
            },
          },
          { $inc: { reservedStock: item.qty } },
          { new: true },
        );
      }

      if (!updated) {
        throw new Error(
          `Unable to reserve stock for item: ${item.name || item.productId}. Stock may have just run out.`,
        );
      }

      reservedItems.push(item);
    }

    // Invalidate product catalog cache so storefront reflects real-time holds
    invalidateCache("products");
  } catch (err) {
    // Rollback any items successfully reserved before the failure
    for (const item of reservedItems) {
      if (item.variantSku) {
        await Product.updateOne(
          { _id: item.productId, "variants.sku": item.variantSku },
          { $inc: { "variants.$.reservedStock": -item.qty } },
        );
      } else {
        await Product.updateOne(
          { _id: item.productId },
          { $inc: { reservedStock: -item.qty } },
        );
      }
    }
    throw err;
  }
};

/**
 * Converts active reservation holds into permanent stock decrements.
 * Can be executed inside an existing Mongoose ACID transaction session.
 */
const finalizeReservation = async (items, session = null) => {
  const options = session ? { session } : {};

  for (const item of items) {
    const productId = item.productId || item.product;

    if (item.variantSku) {
      await Product.updateOne(
        { _id: productId, "variants.sku": item.variantSku },
        {
          $inc: {
            "variants.$.stock": -item.qty,
            "variants.$.reservedStock": -item.qty,
          },
        },
        options,
      );
    } else {
      await Product.updateOne(
        { _id: productId, variants: { $size: 0 } },
        { $inc: { stock: -item.qty, reservedStock: -item.qty } },
        options,
      );
    }
  }

  invalidateCache("products");
};

/**
 * Lazy cleanup for expired online payment attempts.
 */
const releaseExpiredReservations = async () => {
  const expiredOrders = await Order.find({
    "payment.method": "razorpay",
    "payment.status": "pending",
    status: "placed",
    stockReleased: { $ne: true },
    paymentExpiresAt: { $lt: new Date() },
  });

  if (!expiredOrders.length) return;

  for (const order of expiredOrders) {
    for (const item of order.items) {
      if (item.variantSku) {
        await Product.updateOne(
          { _id: item.product, "variants.sku": item.variantSku },
          { $inc: { "variants.$.reservedStock": -item.qty } },
        );
      } else {
        await Product.updateOne(
          { _id: item.product, variants: { $size: 0 } },
          { $inc: { reservedStock: -item.qty } },
        );
      }
    }
    order.status = "expired";
    order.stockReleased = true;
    order.statusHistory.push({ status: "expired" });
    await order.save();
  }

  invalidateCache("products");
};

// Annotates a product with availableStock
const withAvailableStock = (productDoc) => {
  const product = productDoc.toObject ? productDoc.toObject() : productDoc;
  if (product.variants?.length) {
    product.variants = product.variants.map((v) => ({
      ...v,
      availableStock: Math.max(0, (v.stock || 0) - (v.reservedStock || 0)),
    }));
  } else {
    product.availableStock = Math.max(
      0,
      (product.stock || 0) - (product.reservedStock || 0),
    );
  }
  return product;
};

module.exports = {
  RESERVATION_MINUTES,
  reservationDeadline,
  reserveStock,
  finalizeReservation,
  releaseExpiredReservations,
  withAvailableStock,
};
