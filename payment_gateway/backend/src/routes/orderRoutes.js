const express = require("express");
const router = express.Router();

const orderController = require("../controllers/orderController");
const authMiddleware = require("../middleware/authMiddleware");

// Public route first
router.get("/:orderId/public", orderController.getOrderPublic);

// Protected
router.post("/", authMiddleware, orderController.createOrder);
router.get("/:orderId", authMiddleware, orderController.getOrder);

module.exports = router;
