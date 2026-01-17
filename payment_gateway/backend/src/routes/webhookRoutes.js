const express = require("express");
const router = express.Router();

const { listWebhooks, retryWebhook } = require("../controllers/webhookController");

// IMPORTANT: use your existing auth middleware file name
// You currently have authMiddleware.js (not auth.middleware.js)
const authMiddleware = require("../middleware/authMiddleware");

// GET logs
router.get("/", authMiddleware, listWebhooks);

// manual retry
router.post("/:id/retry", authMiddleware, retryWebhook);

module.exports = router;
