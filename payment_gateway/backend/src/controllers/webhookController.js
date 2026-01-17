const { pool } = require("../config/db");
const Queue = require("bull");

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const webhookQueue = new Queue("webhook-queue", REDIS_URL);

// GET /api/v1/webhooks?limit=10&offset=0
// Auth required (merchant)
async function listWebhooks(req, res) {
  try {
    const merchantId = req.merchant.id;

    const limit = Math.min(parseInt(req.query.limit || "10", 10), 50);
    const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);

    const totalRes = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM webhook_events
       WHERE merchant_id=$1`,
      [merchantId]
    );

    const rowsRes = await pool.query(
      `SELECT id, event_type, status, attempts, last_error, next_retry_at, created_at, delivered_at
       FROM webhook_events
       WHERE merchant_id=$1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [merchantId, limit, offset]
    );

    return res.status(200).json({
      data: rowsRes.rows,
      total: totalRes.rows[0].count,
      limit,
      offset,
    });
  } catch (err) {
    console.error("listWebhooks error:", err);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        description: "Failed to fetch webhook logs",
      },
    });
  }
}

// POST /api/v1/webhooks/:id/retry
// Auth required (merchant)
async function retryWebhook(req, res) {
  try {
    const merchantId = req.merchant.id;
    const webhookId = req.params.id;

    const findRes = await pool.query(
      `SELECT id, merchant_id, status, attempts
       FROM webhook_events
       WHERE id=$1`,
      [webhookId]
    );

    if (findRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND_ERROR", description: "Webhook event not found" },
      });
    }

    const row = findRes.rows[0];

    // ensure merchant can retry only their own webhook
    if (row.merchant_id !== merchantId) {
      return res.status(403).json({
        error: {
          code: "AUTHORIZATION_ERROR",
          description: "Not allowed to retry this webhook",
        },
      });
    }

    // ✅ DO NOT reset attempts
    // just schedule it again
    await pool.query(
      `UPDATE webhook_events
       SET status='pending',
           last_error=NULL,
           next_retry_at=NULL,
           delivered_at=NULL
       WHERE id=$1`,
      [webhookId]
    );

    // enqueue webhook delivery for this merchant
    await webhookQueue.add({ merchantId });

    return res.status(200).json({
      id: webhookId,
      status: "pending",
      message: "Webhook retry scheduled",
    });
  } catch (err) {
    console.error("retryWebhook error:", err);
    return res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", description: "Failed to retry webhook" },
    });
  }
}

module.exports = {
  listWebhooks,
  retryWebhook,
};
