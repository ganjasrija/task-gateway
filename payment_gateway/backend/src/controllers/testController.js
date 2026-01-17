const { pool } = require('../config/db');

const getTestMerchant = async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM merchants WHERE email = 'test@example.com'");
        if (result.rows.length === 0) {
            return res.status(404).json({ error: { code: 'NOT_FOUND_ERROR', description: 'Test merchant not found' } });
        }

        const merchant = result.rows[0];
        // Return only specific fields as requested
        res.status(200).json({
            id: merchant.id,
            email: merchant.email,
            api_key: merchant.api_key,
            api_secret: merchant.api_secret, // Exposed only for test verification endpoint
            seeded: true
        });
    } catch (err) {
        console.error('Get Test Merchant Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = {
    getTestMerchant
};
