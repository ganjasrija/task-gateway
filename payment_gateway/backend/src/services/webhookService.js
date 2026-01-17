const crypto = require("crypto");
const axios = require("axios");
const { pool } = require("../config/db");

const MAX_RETRIES = 5;

function signPayload(payload, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(payload))
    .digest("hex");
}

function getRetryDelaysSeconds() {
  const isTestRetry =
    String(process.env.WEBHOOK_RETRY_INTERVALS_TEST).toLowerCase() === "true";

  // Spec-required test mode (fast retries)
  if (isTestRetry) {
    return [0, 5, 10, 15, 20];
  }

  // Spec-required production schedule
  // Attempt 1: immediate
  // Attempt 2: 1 min
  // Attempt 3: 5 min
  // Attempt 4: 30 min
  // Attempt 5: 2 hr
  return [0, 60, 300, 1800, 7200];
}

async function queueWebhookEvent(merchantId, eventType, payload) {
  await pool.query(
    `INSERT INTO webhook_events (merchant_id, event_type, payload, status, attempts)
     VALUES ($1,$2,$3,'pending',0)`,
    [merchantId, eventType, payload]
  );
}

async function deliverWebhook(eventRow) {
  const { id, merchant_id, event_type, payload, attempts } = eventRow;

  // If already maxed out retries, mark failed and stop
  if ((attempts || 0) >= MAX_RETRIES) {
    await pool.query(
      `UPDATE webhook_events
       SET status='failed',
           last_error='Max retries reached',
           next_retry_at=NULL
       WHERE id=$1`,
      [id]
    );
    return;
  }

  const endpointRes = await pool.query(
    `SELECT url, secret
     FROM webhook_endpoints
     WHERE merchant_id=$1 AND is_active=true
     ORDER BY created_at DESC
     LIMIT 1`,
    [merchant_id]
  );

  if (endpointRes.rows.length === 0) {
    await pool.query(
      `UPDATE webhook_events
       SET status='failed',
           last_error='No active webhook endpoint',
           next_retry_at=NULL
       WHERE id=$1`,
      [id]
    );
    return;
  }

  const endpoint = endpointRes.rows[0];
  const signature = signPayload(payload, endpoint.secret);

  // Increment attempts BEFORE sending
  const attemptRes = await pool.query(
    `UPDATE webhook_events
     SET attempts = COALESCE(attempts,0) + 1,
         last_attempt_at = CURRENT_TIMESTAMP
     WHERE id=$1
     RETURNING attempts`,
    [id]
  );

  const currentAttempt = attemptRes.rows[0].attempts;

  try {
    await axios.post(endpoint.url, payload, {
      timeout: 5000,
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": event_type,
      },
    });

    await pool.query(
      `UPDATE webhook_events
       SET status='delivered',
           delivered_at=CURRENT_TIMESTAMP,
           last_error=NULL,
           next_retry_at=NULL
       WHERE id=$1`,
      [id]
    );
  } catch (err) {
    // If max retries reached after this attempt -> mark failed
    if (currentAttempt >= MAX_RETRIES) {
      await pool.query(
        `UPDATE webhook_events
         SET status='failed',
             last_error=$2,
             next_retry_at=NULL
         WHERE id=$1`,
        [id, err.message]
      );
      return;
    }

    const delays = getRetryDelaysSeconds();
    const delaySeconds = delays[currentAttempt] ?? delays[delays.length - 1];

    await pool.query(
      `UPDATE webhook_events
       SET status='pending',
           next_retry_at=CURRENT_TIMESTAMP + ($2 || ' seconds')::interval,
           last_error=$3
       WHERE id=$1`,
      [id, delaySeconds, err.message]
    );
  }
}

module.exports = { queueWebhookEvent, deliverWebhook, MAX_RETRIES };
