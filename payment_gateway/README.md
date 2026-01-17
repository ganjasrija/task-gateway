# Payment Gateway (Production-Ready)

A production-style payment gateway system with merchant authentication, order creation, asynchronous payment/refund processing using job queues, webhook delivery with retries + HMAC signatures, idempotency keys, an embeddable checkout JavaScript SDK, a merchant dashboard, and a hosted checkout page.

---

## Features

### Core APIs
- Merchant authentication using API Key + Secret
- Orders API (create + fetch)
- Payments API (create + fetch + list)
- Refunds API (create + fetch)
- Webhook logs API (list + manual retry)

### Asynchronous Processing (Queue + Worker)
- Payments are created with `status=pending`
- Worker processes payments in background and updates to `success` / `failed`
- Refunds are created with `status=pending`
- Worker processes refunds in background and updates to `processed`

### Webhooks (Retry + HMAC Signature)
- Merchant webhook endpoint is stored in DB
- Webhook events are stored in DB and delivered asynchronously
- Automatic retry logic (max 5 attempts)
- Each webhook request includes `X-Webhook-Signature` header (HMAC-SHA256)

### Idempotency Keys
- Payment creation supports optional `Idempotency-Key`
- Same key for the same merchant returns the same cached response (prevents duplicate charges)

### Frontend Apps Included
- Merchant Dashboard (React)
- Hosted Checkout Page (React)
- Embeddable JavaScript SDK (`checkout.js`) to open checkout in modal + iframe

---

## Tech Stack

- Node.js (Express)
- PostgreSQL
- Redis
- Bull Queue (job processing)
- Docker + Docker Compose
- React (Dashboard + Checkout)

---

## Repository Structure

payment_gateway/
├── backend/
│ ├── src/
│ │ ├── config/
│ │ ├── controllers/
│ │ ├── middleware/
│ │ ├── routes/
│ │ ├── services/
│ │ └── ...
│ ├── worker.js
│ ├── package.json
│ └── ...
├── dashboard/
├── checkout-page/
├── docker-compose.yml
└── README.md


---

## Getting Started (Docker)

### 1) Prerequisites
- Docker Desktop installed and running

### 2) Start the full system
From the root folder:

```bash
docker compose up --build
This starts:

PostgreSQL

Redis

Backend API

Worker

Dashboard

Checkout page

3) Verify health
curl http://localhost:8000/health
Expected response (example):

{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "worker": "running"
}
Test Merchant Credentials
A test merchant is seeded automatically for development/testing.

Get test merchant credentials
curl http://localhost:8000/api/v1/test/merchant
Expected response (example):

{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "test@example.com",
  "api_key": "key_test_abc123",
  "api_secret": "secret_test_xyz789",
  "seeded": true
}
API Usage (Windows CMD curl)
All protected endpoints require these headers:

X-Api-Key

X-Api-Secret

Replace values below if your seeded keys are different.

1) Create Order (Protected)
curl -X POST http://localhost:8000/api/v1/orders ^
  -H "X-Api-Key: key_test_abc123" ^
  -H "X-Api-Secret: secret_test_xyz789" ^
  -H "Content-Type: application/json" ^
  -d "{\"amount\":50000,\"currency\":\"INR\",\"receipt\":\"rcpt_123\"}"
Response (example):

{
  "id": "order_xxxxx",
  "amount": 50000,
  "currency": "INR",
  "receipt": "rcpt_123",
  "status": "created"
}
2) Fetch Order (Public Checkout)
curl -X GET http://localhost:8000/api/v1/orders/order_xxxxx/public
3) Create Payment (Protected + Idempotency)
curl -X POST http://localhost:8000/api/v1/payments ^
  -H "X-Api-Key: key_test_abc123" ^
  -H "X-Api-Secret: secret_test_xyz789" ^
  -H "Idempotency-Key: abc123" ^
  -H "Content-Type: application/json" ^
  -d "{\"order_id\":\"order_xxxxx\",\"method\":\"upi\",\"vpa\":\"user@paytm\"}"
Notes:

Payment is created with status=pending

Worker later updates it to success or failed

4) Fetch Payment (Protected)
curl -X GET http://localhost:8000/api/v1/payments/pay_xxxxx ^
  -H "X-Api-Key: key_test_abc123" ^
  -H "X-Api-Secret: secret_test_xyz789"
5) Create Payment (Public Checkout Flow)
Used by hosted checkout page.

curl -X POST http://localhost:8000/api/v1/payments/public ^
  -H "Content-Type: application/json" ^
  -d "{\"order_id\":\"order_xxxxx\",\"method\":\"upi\",\"vpa\":\"user@paytm\"}"
6) Fetch Payment Status (Public)
Used for checkout polling.

curl -X GET http://localhost:8000/api/v1/payments/pay_xxxxx/public
7) Create Refund (Protected)
Only successful payments can be refunded.

curl -X POST http://localhost:8000/api/v1/payments/pay_xxxxx/refunds ^
  -H "X-Api-Key: key_test_abc123" ^
  -H "X-Api-Secret: secret_test_xyz789" ^
  -H "Content-Type: application/json" ^
  -d "{\"amount\":20000,\"reason\":\"customer requested\"}"
Response (example):

{
  "id": "rfnd_xxxxx",
  "payment_id": "pay_xxxxx",
  "amount": 20000,
  "reason": "customer requested",
  "status": "pending"
}
Worker updates refund to processed.

8) Fetch Refund (Protected)
curl -X GET http://localhost:8000/api/v1/refunds/rfnd_xxxxx ^
  -H "X-Api-Key: key_test_abc123" ^
  -H "X-Api-Secret: secret_test_xyz789"
Webhooks
Database Tables
webhook_endpoints stores merchant webhook configuration

webhook_events stores webhook delivery logs + retry attempts

Events Supported
payment.success

payment.failed

refund.processed

Delivery Flow
Payment/Refund worker creates a row in webhook_events

Webhook worker reads pending events and delivers them to merchant endpoint

Signature is generated using HMAC-SHA256 and added in header:

X-Webhook-Signature: <signature>

If delivery fails:

status remains pending

attempts increments

next_retry_at is scheduled

After max retries (5):

status becomes failed

Check Webhook Event Logs (PostgreSQL)
docker exec -it pg_gateway psql -U gateway_user -d payment_gateway -c "SELECT id,event_type,status,attempts,last_error,next_retry_at FROM webhook_events ORDER BY id DESC LIMIT 10;"
Webhook Logs API (Protected)
List webhook events:

curl -X GET "http://localhost:8000/api/v1/webhooks?limit=10&offset=0" ^
  -H "X-Api-Key: key_test_abc123" ^
  -H "X-Api-Secret: secret_test_xyz789"
Retry webhook event manually:

curl -X POST http://localhost:8000/api/v1/webhooks/10/retry ^
  -H "X-Api-Key: key_test_abc123" ^
  -H "X-Api-Secret: secret_test_xyz789"
Worker Logs
API logs:

docker logs -f gateway_api
Worker logs:

docker logs -f gateway_worker
Dashboard
The merchant dashboard provides:

API credentials display

Payment stats (total transactions, total amount, success rate)

Transactions list

Webhook configuration + webhook delivery logs + manual retry

Open the dashboard (as per docker-compose port mapping):

http://localhost:3000

Hosted Checkout Page
The hosted checkout page supports:

Order summary display

Payment method selection (UPI / Card)

Public payment creation

Polling payment status until success / failed

Open checkout page:

http://localhost:3001/checkout?order_id=YOUR_ORDER_ID

Embeddable JavaScript SDK
The checkout SDK is served as:

http://localhost:3001/checkout.js

Merchant Integration Example
<script src="http://localhost:3001/checkout.js"></script>

<button id="pay-button">Pay Now</button>

<script>
  document.getElementById("pay-button").addEventListener("click", function () {
    const checkout = new PaymentGateway({
      key: "key_test_abc123",
      orderId: "order_xxxxx",
      onSuccess: function (response) {
        console.log("Payment successful:", response.paymentId);
      },
      onFailure: function (error) {
        console.log("Payment failed:", error);
      },
      onClose: function () {
        console.log("Checkout closed");
      }
    });

    checkout.open();
  });
</script>
SDK behavior:

Opens a modal overlay

Loads checkout page inside iframe

Uses postMessage communication between iframe and parent page
Notes

This project is built for local development and evaluation

Uses async processing patterns used in real payment systems:

job queues + workers

webhook retries + delivery tracking

idempotency for safe retries