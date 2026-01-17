const { pool } = require("../config/db");
const {
  validateVpa,
  validateLuhn,
  getCardNetwork,
  validateExpiry,
} = require("../services/validationService");
const Queue = require("bull");

const paymentQueue = new Queue(
  "payment-queue",
  process.env.REDIS_URL || "redis://127.0.0.1:6379"
);

// Async ID generation with collision check
async function generateUniquePaymentId() {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let isUnique = false;
  let result = "";

  while (!isUnique) {
    result = "pay_";
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const check = await pool.query("SELECT 1 FROM payments WHERE id = $1", [
      result,
    ]);
    if (check.rows.length === 0) {
      isUnique = true;
    }
  }
  return result;
}

const validatePaymentInput = (method, vpa, card) => {
  if (method === "upi") {
    if (!vpa || !validateVpa(vpa)) {
      return {
        valid: false,
        error: { code: "INVALID_VPA", description: "VPA format invalid" },
      };
    }
    return { valid: true };
  } else if (method === "card") {
    if (!card) {
      return {
        valid: false,
        error: { code: "INVALID_CARD", description: "Card details missing" },
      };
    }

    if (!validateLuhn(card.number)) {
      return {
        valid: false,
        error: { code: "INVALID_CARD", description: "Card validation failed" },
      };
    }

    if (!validateExpiry(card.expiry_month, card.expiry_year)) {
      return {
        valid: false,
        error: {
          code: "EXPIRED_CARD",
          description: "Card expiry date invalid",
        },
      };
    }

    const cardNetwork = getCardNetwork(card.number);
    const cardLast4 = card.number.replace(/[\s-]/g, "").slice(-4);
    return { valid: true, cardNetwork, cardLast4 };
  } else {
    return {
      valid: false,
      error: { code: "BAD_REQUEST_ERROR", description: "Invalid payment method" },
    };
  }
};

const createPayment = async (req, res) => {
  const client = await pool.connect();

  try {
    const merchantId = req.merchant.id;
    const { order_id, method, vpa, card } = req.body;

    // ✅ Idempotency Key (Deliverable-2)
    const idempotencyKey = req.headers["idempotency-key"];

    await client.query("BEGIN");

    // ✅ If Idempotency-Key exists, return saved response
    if (idempotencyKey) {
      const existing = await client.query(
        `SELECT response, expires_at
         FROM idempotency_keys
         WHERE key=$1 AND merchant_id=$2`,
        [idempotencyKey, merchantId]
      );

      if (existing.rows.length > 0) {
        const record = existing.rows[0];

        if (new Date(record.expires_at) > new Date()) {
          await client.query("ROLLBACK");
          return res.status(201).json(record.response);
        } else {
          // expired -> delete and continue normally
          await client.query(
            `DELETE FROM idempotency_keys WHERE key=$1 AND merchant_id=$2`,
            [idempotencyKey, merchantId]
          );
        }
      }
    }

    // 1. Verify Order
    const orderResult = await client.query("SELECT * FROM orders WHERE id = $1", [
      order_id,
    ]);

    if (orderResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND_ERROR", description: "Order not found" } });
    }

    const order = orderResult.rows[0];

    if (order.merchant_id !== merchantId) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND_ERROR", description: "Order not found" } });
    }

    // 2. Validate
    const validRes = validatePaymentInput(method, vpa, card);
    if (!validRes.valid) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: validRes.error });
    }

    const cardNetwork = validRes.cardNetwork || null;
    const cardLast4 = validRes.cardLast4 || null;

    // 3. Insert Payment (status pending)
    const paymentId = await generateUniquePaymentId();

    const insertQuery = `
      INSERT INTO payments (
        id, order_id, merchant_id, amount, currency, method, status,
        vpa, card_network, card_last4
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *;
    `;

    const values = [
      paymentId,
      order_id,
      merchantId,
      order.amount,
      order.currency,
      method,
      "pending",
      method === "upi" ? vpa : null,
      cardNetwork,
      cardLast4,
    ];

    const paymentResult = await client.query(insertQuery, values);
    const payment = paymentResult.rows[0];

    // ✅ Store response for Idempotency-Key (commit with transaction)
    if (idempotencyKey) {
      await client.query(
        `INSERT INTO idempotency_keys (key, merchant_id, response, expires_at)
         VALUES ($1,$2,$3, CURRENT_TIMESTAMP + INTERVAL '24 hours')
         ON CONFLICT (key, merchant_id) DO NOTHING`,
        [idempotencyKey, merchantId, payment]
      );
    }

    await client.query("COMMIT");

    // Return immediately (async processing)
    res.status(201).json(payment);

    // Enqueue async job for worker
    await paymentQueue.add({
      paymentId: payment.id,
      method: payment.method,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create Payment Transaction Error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
};

const createPaymentPublic = async (req, res) => {
  const client = await pool.connect();

  try {
    const { order_id, method, vpa, card } = req.body;

    await client.query("BEGIN");

    // 1. Verify Order
    const orderResult = await client.query("SELECT * FROM orders WHERE id = $1", [
      order_id,
    ]);

    if (orderResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND_ERROR", description: "Order not found" } });
    }

    const order = orderResult.rows[0];
    const merchantId = order.merchant_id;

    // 2. Validate
    const validRes = validatePaymentInput(method, vpa, card);
    if (!validRes.valid) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: validRes.error });
    }

    const cardNetwork = validRes.cardNetwork || null;
    const cardLast4 = validRes.cardLast4 || null;

    // 3. Insert Payment (status pending)
    const paymentId = await generateUniquePaymentId();

    const insertQuery = `
      INSERT INTO payments (
        id, order_id, merchant_id, amount, currency, method, status,
        vpa, card_network, card_last4
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *;
    `;

    const values = [
      paymentId,
      order_id,
      merchantId,
      order.amount,
      order.currency,
      method,
      "pending",
      method === "upi" ? vpa : null,
      cardNetwork,
      cardLast4,
    ];

    const paymentResult = await client.query(insertQuery, values);
    await client.query("COMMIT");

    const payment = paymentResult.rows[0];

    res.status(201).json(payment);

    await paymentQueue.add({
      paymentId: payment.id,
      method: payment.method,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create Public Payment Error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
};

const getPayment = async (req, res) => {
  const { paymentId } = req.params;
  const merchantId = req.merchant.id;

  try {
    const result = await pool.query("SELECT * FROM payments WHERE id = $1", [
      paymentId,
    ]);

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND_ERROR", description: "Payment not found" } });
    }

    const payment = result.rows[0];

    if (payment.merchant_id !== merchantId) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND_ERROR", description: "Payment not found" } });
    }

    res.status(200).json(payment);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getPaymentPublic = async (req, res) => {
  const { paymentId } = req.params;

  try {
    const result = await pool.query(
      "SELECT id, order_id, amount, currency, method, status, vpa, card_network, card_last4, created_at FROM payments WHERE id = $1",
      [paymentId]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND_ERROR", description: "Payment not found" } });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const listPayments = async (req, res) => {
  const merchantId = req.merchant.id;

  try {
    const result = await pool.query(
      "SELECT * FROM payments WHERE merchant_id = $1 ORDER BY created_at DESC",
      [merchantId]
    );

    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getDashboardStats = async (req, res) => {
  const merchantId = req.merchant.id;

  try {
    const query = `
      SELECT
        COUNT(*) as total_transactions,
        COALESCE(SUM(CASE WHEN status = 'success' THEN amount ELSE 0 END), 0) as total_amount,
        COALESCE(
          ROUND(
            (COUNT(CASE WHEN status = 'success' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100),
            2
          ),
          0
        ) as success_rate
      FROM payments
      WHERE merchant_id = $1
    `;

    const result = await pool.query(query, [merchantId]);
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Dashboard Stats Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  createPayment,
  getPayment,
  createPaymentPublic,
  getPaymentPublic,
  listPayments,
  getDashboardStats,
};
