# Database Schema Documentation

This project uses **PostgreSQL** as the primary database.  
The schema is designed to support merchant authentication, order creation, async payment processing, refunds, idempotency, and webhook delivery with retries.

---

## Merchants

Stores merchant details and API credentials used for authentication.

**Table:** `merchants`

| Column | Type | Description |
|-------|------|-------------|
| id | UUID (PK) | Unique merchant identifier |
| name | VARCHAR | Merchant name |
| email | VARCHAR (UNIQUE) | Merchant email |
| api_key | VARCHAR | API key used in request headers |
| api_secret | VARCHAR | API secret used in request headers |
| is_active | BOOLEAN | Active status (default: true) |
| created_at | TIMESTAMP | Created timestamp |
| updated_at | TIMESTAMP | Updated timestamp |

---

## Orders

Represents payment orders created by merchants.

**Table:** `orders`

| Column | Type | Description |
|-------|------|-------------|
| id | VARCHAR (PK) | Order ID (`order_` + random string) |
| merchant_id | UUID (FK) | References `merchants.id` |
| amount | INTEGER | Amount in paise (minimum 100) |
| currency | VARCHAR(3) | Currency code (default: INR) |
| receipt | VARCHAR | Optional receipt reference |
| notes | JSONB | Optional metadata |
| status | VARCHAR | Order status (default: `created`) |
| created_at | TIMESTAMP | Created timestamp |
| updated_at | TIMESTAMP | Updated timestamp |

**Relationships**
- `orders.merchant_id → merchants.id`

---

## Payments

Tracks payment attempts for orders.  
Payments are created as `pending` and later updated asynchronously by the worker.

**Table:** `payments`

| Column | Type | Description |
|-------|------|-------------|
| id | VARCHAR (PK) | Payment ID (`pay_` + random string) |
| order_id | VARCHAR (FK) | References `orders.id` |
| merchant_id | UUID (FK) | References `merchants.id` |
| amount | INTEGER | Amount in paise |
| currency | VARCHAR(3) | Currency code |
| method | VARCHAR | Payment method (`upi` / `card`) |
| status | VARCHAR | `pending` / `success` / `failed` |
| vpa | VARCHAR | UPI VPA (UPI only) |
| card_network | VARCHAR | Card network (card only) |
| card_last4 | VARCHAR(4) | Last 4 digits of card number |
| error_code | VARCHAR | Failure code (if failed) |
| error_description | TEXT | Failure description (if failed) |
| created_at | TIMESTAMP | Created timestamp |
| updated_at | TIMESTAMP | Updated timestamp |

**Relationships**
- `payments.order_id → orders.id`
- `payments.merchant_id → merchants.id`

---

## Refunds

Refunds are created as `pending` and processed asynchronously by the worker.

**Table:** `refunds`

| Column | Type | Description |
|-------|------|-------------|
| id | VARCHAR (PK) | Refund ID (`rfnd_` + random string) |
| payment_id | VARCHAR (FK) | References `payments.id` |
| merchant_id | UUID (FK) | References `merchants.id` |
| amount | INTEGER | Refund amount in paise |
| reason | TEXT | Optional reason |
| status | VARCHAR | `pending` / `processed` |
| created_at | TIMESTAMP | Created timestamp |
| processed_at | TIMESTAMP | When refund was processed |

**Relationships**
- `refunds.payment_id → payments.id`
- `refunds.merchant_id → merchants.id`

---

## Idempotency Keys

Ensures duplicate payment requests with the same idempotency key return the same result.

**Table:** `idempotency_keys`

| Column | Type | Description |
|-------|------|-------------|
| key | VARCHAR (PK) | Idempotency key from request header |
| merchant_id | UUID (FK) | References `merchants.id` |
| response | JSONB | Stored API response payload |
| created_at | TIMESTAMP | Created timestamp |
| expires_at | TIMESTAMP | Expiration timestamp |

**Relationships**
- `idempotency_keys.merchant_id → merchants.id`

---

## Webhook Endpoints

Stores merchant webhook endpoint configuration.

**Table:** `webhook_endpoints`

| Column | Type | Description |
|-------|------|-------------|
| id | SERIAL (PK) | Endpoint identifier |
| merchant_id | UUID (FK) | References `merchants.id` |
| url | TEXT | Webhook receiver URL |
| secret | TEXT | HMAC signing secret |
| is_active | BOOLEAN | Active status |
| created_at | TIMESTAMP | Created timestamp |

**Relationships**
- `webhook_endpoints.merchant_id → merchants.id`

---

## Webhook Events

Stores webhook delivery jobs and retry state.

**Table:** `webhook_events`

| Column | Type | Description |
|-------|------|-------------|
| id | SERIAL (PK) | Event identifier |
| merchant_id | UUID (FK) | References `merchants.id` |
| event_type | VARCHAR | Example: `payment.success`, `refund.processed` |
| payload | JSONB | Webhook payload body |
| status | VARCHAR | `pending` / `delivered` / `failed` |
| attempts | INTEGER | Delivery attempt counter |
| last_error | TEXT | Last failure reason (if any) |
| next_retry_at | TIMESTAMP | When the next retry is allowed |
| delivered_at | TIMESTAMP | When delivery succeeded |
| created_at | TIMESTAMP | Created timestamp |

**Relationships**
- `webhook_events.merchant_id → merchants.id`

---

## Database Seeding

On startup, the system seeds a test merchant (if not already present):

- Email: `test@example.com`
- API Key: `key_test_abc123`
- API Secret: `secret_test_xyz789`
