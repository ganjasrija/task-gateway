const Queue = require("bull");
const path = require("path");

// Correct DB path
const dbPath = path.join(__dirname, "src", "config", "db");
const { pool } = require(dbPath);

// Webhook service
const { queueWebhookEvent, deliverWebhook } = require("./src/services/webhookService");

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

console.log("Worker running... waiting for jobs");

// ---------------- QUEUES ----------------
const paymentQueue = new Queue("payment-queue", REDIS_URL);
const refundQueue = new Queue("refund-queue", REDIS_URL);
const webhookQueue = new Queue("webhook-queue", REDIS_URL);

// ================= PAYMENT PROCESSOR =================
paymentQueue.process(async (job) => {
  try {
    const { paymentId, method } = job.data;

    const isTestMode = String(process.env.TEST_MODE).toLowerCase() === "true";
    const testSuccess =
      String(process.env.TEST_PAYMENT_SUCCESS).toLowerCase() !== "false";

    const testDelayEnv = parseInt(process.env.TEST_PROCESSING_DELAY || "1000", 10);
    const testDelay = isNaN(testDelayEnv) ? 1000 : testDelayEnv;

    let delay;
    let success;

    if (isTestMode) {
      console.log(`[Worker] TEST MODE: delay=${testDelay}ms success=${testSuccess}`);
      delay = testDelay;
      success = testSuccess;
    } else {
      delay = Math.floor(Math.random() * (10000 - 5000 + 1) + 5000);
      const rand = Math.random();
      success = method === "upi" ? rand < 0.9 : rand < 0.95;
    }

    await new Promise((res) => setTimeout(res, delay));

    const newStatus = success ? "success" : "failed";
    const error_code = success ? null : "PAYMENT_FAILED";
    const error_description = success ? null : "Payment processing failed";

    await pool.query(
      `UPDATE payments
       SET status=$1, error_code=$2, error_description=$3, updated_at=CURRENT_TIMESTAMP
       WHERE id=$4`,
      [newStatus, error_code, error_description, paymentId]
    );

    console.log(`Payment ${paymentId} processed: ${newStatus}`);

    // Fetch payment for webhook payload
    const payRes = await pool.query(`SELECT * FROM payments WHERE id=$1`, [paymentId]);
    if (payRes.rows.length === 0) return;

    const payment = payRes.rows[0];
    const eventType = newStatus === "success" ? "payment.success" : "payment.failed";

    await queueWebhookEvent(payment.merchant_id, eventType, {
      event: eventType,
      data: payment,
    });

    // Trigger webhook delivery
    await webhookQueue.add({ merchantId: payment.merchant_id });
  } catch (err) {
    console.error("Payment worker error:", err);
    throw err;
  }
});

// ================= REFUND PROCESSOR =================
refundQueue.process(async (job) => {
  try {
    const { refundId } = job.data;

    console.log("Processing refund:", refundId);

    // Simulate delay
    await new Promise((res) => setTimeout(res, 3000));

    await pool.query(
      `UPDATE refunds
       SET status='processed', processed_at=CURRENT_TIMESTAMP
       WHERE id=$1`,
      [refundId]
    );

    console.log("Refund processed:", refundId);

    // Fetch refund for webhook payload
    const refundRes = await pool.query(`SELECT * FROM refunds WHERE id=$1`, [refundId]);
    if (refundRes.rows.length === 0) return;

    const refund = refundRes.rows[0];
    const eventType = "refund.processed";

    await queueWebhookEvent(refund.merchant_id, eventType, {
      event: eventType,
      data: refund,
    });

    await webhookQueue.add({ merchantId: refund.merchant_id });
  } catch (err) {
    console.error("Refund worker error:", err);
    throw err;
  }
});

// ================= WEBHOOK PROCESSOR =================
webhookQueue.process(async (job) => {
  try {
    const { merchantId } = job.data;

    const result = await pool.query(
      `SELECT *
       FROM webhook_events
       WHERE merchant_id=$1
         AND status='pending'
         AND (next_retry_at IS NULL OR next_retry_at <= CURRENT_TIMESTAMP)
       ORDER BY created_at ASC
       LIMIT 1`,
      [merchantId]
    );

    if (result.rows.length === 0) return;

    const eventRow = result.rows[0];

    console.log(
      `Delivering webhook event ${eventRow.id} (${eventRow.event_type}) attempt=${(eventRow.attempts || 0) + 1}`
    );

    await deliverWebhook(eventRow);

    // If more pending events exist, schedule again
    const remaining = await pool.query(
      `SELECT 1
       FROM webhook_events
       WHERE merchant_id=$1
         AND status='pending'
         AND (next_retry_at IS NULL OR next_retry_at <= CURRENT_TIMESTAMP)
       LIMIT 1`,
      [merchantId]
    );

    if (remaining.rows.length > 0) {
      await webhookQueue.add({ merchantId });
    }
  } catch (err) {
    console.error("Webhook worker error:", err);
    throw err;
  }
});

// ================= WEBHOOK RETRY POLLER =================
// Ensures retries happen even if no new payments/refunds are created.
setInterval(async () => {
  try {
    const due = await pool.query(
      `SELECT DISTINCT merchant_id
       FROM webhook_events
       WHERE status='pending'
         AND (next_retry_at IS NULL OR next_retry_at <= CURRENT_TIMESTAMP)
       LIMIT 5`
    );

    for (const row of due.rows) {
      await webhookQueue.add({ merchantId: row.merchant_id });
    }
  } catch (err) {
    console.error("Webhook poller error:", err.message);
  }
}, 5000);
