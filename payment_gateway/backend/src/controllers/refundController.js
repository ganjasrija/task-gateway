const { pool } = require("../config/db");
const Queue = require("bull");

const refundQueue = new Queue(
  "refund-queue",
  process.env.REDIS_URL || "redis://127.0.0.1:6379"
);

// Generate refund id: rfnd_ + 16 chars
function generateRefundId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "rfnd_";
  for (let i = 0; i < 16; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// POST /api/v1/payments/:payment_id/refunds
const createRefund = async (req, res) => {
  const merchantId = req.merchant.id;
  const { payment_id } = req.params;
  const { amount, reason } = req.body;

  if (!amount || typeof amount !== "number") {
    return res.status(400).json({
      error: { code: "BAD_REQUEST_ERROR", description: "Amount is required" },
    });
  }

  try {
    // 1) Verify payment belongs to merchant
    const payRes = await pool.query(
      "SELECT * FROM payments WHERE id=$1 AND merchant_id=$2",
      [payment_id, merchantId]
    );

    if (payRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND_ERROR", description: "Payment not found" },
      });
    }

    const payment = payRes.rows[0];

    // 2) Only success payments refundable
    if (payment.status !== "success") {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST_ERROR",
          description: "Payment not in refundable state",
        },
      });
    }

    // 3) Total refunded check
    const refundSumRes = await pool.query(
      "SELECT COALESCE(SUM(amount),0) as total FROM refunds WHERE payment_id=$1",
      [payment_id]
    );

    const totalRefunded = parseInt(refundSumRes.rows[0].total || 0, 10);
    const available = payment.amount - totalRefunded;

    if (amount > available) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST_ERROR",
          description: "Refund amount exceeds available amount",
        },
      });
    }

    // 4) Create refund record
    let refundId = generateRefundId();

    // Collision check (rare but safe)
    while (true) {
      const check = await pool.query("SELECT 1 FROM refunds WHERE id=$1", [
        refundId,
      ]);
      if (check.rows.length === 0) break;
      refundId = generateRefundId();
    }

    const insertRes = await pool.query(
      `INSERT INTO refunds (id, payment_id, merchant_id, amount, reason, status)
       VALUES ($1,$2,$3,$4,$5,'pending')
       RETURNING *`,
      [refundId, payment_id, merchantId, amount, reason || null]
    );

    const refund = insertRes.rows[0];

    // 5) Enqueue async refund job
    await refundQueue.add({ refundId: refund.id });

    return res.status(201).json({
      id: refund.id,
      payment_id: refund.payment_id,
      amount: refund.amount,
      reason: refund.reason,
      status: refund.status,
      created_at: refund.created_at,
    });
  } catch (err) {
    console.error("Create Refund Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// GET /api/v1/refunds/:refund_id
const getRefund = async (req, res) => {
  const merchantId = req.merchant.id;
  const { refund_id } = req.params;

  try {
    const result = await pool.query(
      "SELECT * FROM refunds WHERE id=$1 AND merchant_id=$2",
      [refund_id, merchantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND_ERROR", description: "Refund not found" },
      });
    }

    const r = result.rows[0];

    return res.status(200).json({
      id: r.id,
      payment_id: r.payment_id,
      amount: r.amount,
      reason: r.reason,
      status: r.status,
      created_at: r.created_at,
      processed_at: r.processed_at,
    });
  } catch (err) {
    console.error("Get Refund Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { createRefund, getRefund };
