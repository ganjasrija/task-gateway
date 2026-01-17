# Payment Gateway API Documentation

Base URL:  
http://localhost:8000

API Base Path:  
http://localhost:8000/api/v1

---

## Health Check

### GET /health
Checks system readiness.

**Request**
```http
GET /health
Response (200)

{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "worker": "running",
  "timestamp": "2026-01-07T12:36:56.874Z"
}
Authentication
All merchant-protected endpoints require the following headers:

X-Api-Key: key_test_abc123
X-Api-Secret: secret_test_xyz789
Orders
Create Order (Authenticated)
POST /api/v1/orders

Headers

X-Api-Key: key_test_abc123
X-Api-Secret: secret_test_xyz789
Content-Type: application/json
Request Body

{
  "amount": 50000,
  "currency": "INR",
  "receipt": "receipt_123",
  "notes": {
    "customer_name": "John Doe"
  }
}
Response (201)

{
  "id": "order_AbCdEfGhIjKlMnOp",
  "merchant_id": "550e8400-e29b-41d4-a716-446655440000",
  "amount": 50000,
  "currency": "INR",
  "receipt": "receipt_123",
  "notes": {},
  "status": "created",
  "created_at": "2026-01-07T12:49:21.049Z"
}
Error (400)

{
  "error": {
    "code": "BAD_REQUEST_ERROR",
    "description": "amount must be at least 100"
  }
}
Get Order (Authenticated)
GET /api/v1/orders/{order_id}

Headers

X-Api-Key: key_test_abc123
X-Api-Secret: secret_test_xyz789
Response (200)

{
  "id": "order_AbCdEfGhIjKlMnOp",
  "merchant_id": "550e8400-e29b-41d4-a716-446655440000",
  "amount": 50000,
  "currency": "INR",
  "receipt": "receipt_123",
  "notes": {},
  "status": "created",
  "created_at": "2026-01-07T12:49:21.049Z",
  "updated_at": "2026-01-07T12:49:21.049Z"
}
Get Order (Public – Checkout)
GET /api/v1/orders/{order_id}/public

No authentication required.

Response (200)

{
  "id": "order_AbCdEfGhIjKlMnOp",
  "amount": 50000,
  "currency": "INR",
  "status": "created"
}
Payments
Create Payment (Authenticated)
POST /api/v1/payments

Headers

X-Api-Key: key_test_abc123
X-Api-Secret: secret_test_xyz789
Content-Type: application/json
UPI Payment Request

{
  "order_id": "order_AbCdEfGhIjKlMnOp",
  "method": "upi",
  "vpa": "user@paytm"
}
Card Payment Request

{
  "order_id": "order_AbCdEfGhIjKlMnOp",
  "method": "card",
  "card": {
    "number": "4111111111111111",
    "expiry_month": "12",
    "expiry_year": "2026",
    "cvv": "123",
    "holder_name": "John Doe"
  }
}
Response (201)

{
  "id": "pay_XyZkLmNoPqRsTuVw",
  "order_id": "order_AbCdEfGhIjKlMnOp",
  "amount": 50000,
  "currency": "INR",
  "method": "upi",
  "status": "processing",
  "created_at": "2026-01-07T13:08:26.137Z"
}
Create Payment (Public – Checkout)
POST /api/v1/payments/public

No authentication required.

Request Body

{
  "order_id": "order_AbCdEfGhIjKlMnOp",
  "method": "upi",
  "vpa": "user@paytm"
}
Get Payment Status (Authenticated)
GET /api/v1/payments/{payment_id}

Headers

X-Api-Key: key_test_abc123
X-Api-Secret: secret_test_xyz789
Response (200)

{
  "id": "pay_XyZkLmNoPqRsTuVw",
  "order_id": "order_AbCdEfGhIjKlMnOp",
  "amount": 50000,
  "currency": "INR",
  "method": "upi",
  "status": "success",
  "created_at": "2026-01-07T13:08:26.137Z",
  "updated_at": "2026-01-07T13:08:36.137Z"
}
Test Merchant Endpoint
GET /api/v1/test/merchant
Response (200)

{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "test@example.com",
  "api_key": "key_test_abc123",
  "seeded": true
}
Error Codes
Code	Meaning
AUTHENTICATION_ERROR	Invalid API credentials
BAD_REQUEST_ERROR	Validation failure
NOT_FOUND_ERROR	Resource not found
INVALID_VPA	Invalid UPI VPA
INVALID_CARD	Card validation failed
EXPIRED_CARD	Card expired
PAYMENT_FAILED	Payment processing failed