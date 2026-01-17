const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

const { createRefund, getRefund } = require("../controllers/refundController");

router.post("/payments/:payment_id/refunds", authMiddleware, createRefund);
router.get("/refunds/:refund_id", authMiddleware, getRefund);

module.exports = router;
