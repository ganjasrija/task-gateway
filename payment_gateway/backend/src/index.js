require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { initDb, pool } = require("./config/db");
const { createClient } = require("redis");

const app = express();
const port = process.env.PORT || 8000;

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => console.log("Redis Client Error", err));

app.use(cors());
app.use(bodyParser.json());

// Health Check
app.get("/health", async (req, res) => {
  let dbStatus = "disconnected";
  let redisStatus = "disconnected";

  try {
    await pool.query("SELECT 1");
    dbStatus = "connected";
  } catch (err) {
    console.error("Health Check DB Error:", err);
  }

  try {
    await redisClient.ping();
    redisStatus = "connected";
  } catch (err) {
    console.error("Health Check Redis Error:", err);
  }

  res.status(200).json({
    status:
      dbStatus === "connected" && redisStatus === "connected"
        ? "healthy"
        : "unhealthy",
    database: dbStatus,
    redis: redisStatus,
    worker: "running",
    timestamp: new Date().toISOString(),
  });
});

// Routes
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const refundRoutes = require("./routes/refundRoutes");
const testRoutes = require("./routes/testRoutes");
const webhookRoutes = require("./routes/webhookRoutes");


app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1", refundRoutes);
app.use("/api/v1/test", testRoutes);
app.use("/api/v1/webhooks", webhookRoutes);
// Start Server and Init DB
const startServer = async () => {
  try {
    await initDb();
    await redisClient.connect();

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
};

startServer();
