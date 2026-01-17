const { pool } = require("../config/db");

const authMiddleware = async (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  const apiSecret = req.headers["x-api-secret"];

  if (!apiKey || !apiSecret) {
    return res.status(401).json({
      error: {
        code: "AUTHENTICATION_ERROR",
        description: "Invalid API credentials",
      },
    });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM merchants WHERE api_key = $1 AND api_secret = $2",
      [apiKey, apiSecret]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: {
          code: "AUTHENTICATION_ERROR",
          description: "Invalid API credentials",
        },
      });
    }

    req.merchant = result.rows[0];
    next();
  } catch (err) {
    console.error("Auth Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = authMiddleware;
