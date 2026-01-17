const express = require("express");
const router = express.Router();

const paymentController = require("../controllers/paymentController");
const authMiddleware = require("../middleware/authMiddleware");


// Public Routes
router.post("/public", paymentController.createPaymentPublic);
router.get("/:paymentId/public", paymentController.getPaymentPublic);

// Dashboard Stats (keep BEFORE dynamic protected routes)
router.get("/dashboard-stats", authMiddleware, paymentController.getDashboardStats);

// Protected Routes
router.post("/", authMiddleware, paymentController.createPayment);
router.get("/", authMiddleware, paymentController.listPayments);
router.get("/:paymentId", authMiddleware, paymentController.getPayment);

module.exports = router;
