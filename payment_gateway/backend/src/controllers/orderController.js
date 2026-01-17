const { pool } = require('../config/db');

function generateOrderId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'order_';
    for (let i = 0; i < 16; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

const createOrder = async (req, res) => {
    const { amount, currency, receipt, notes } = req.body;
    const merchantId = req.merchant.id;

    if (!amount || !Number.isInteger(amount) || amount < 100) {
        return res.status(400).json({
            error: {
                code: 'BAD_REQUEST_ERROR',
                description: 'amount must be at least 100'
            }
        });
    }

    const orderId = generateOrderId();
    const currencyCode = currency || 'INR';
    const status = 'created';

    try {
        const query = `
            INSERT INTO orders (id, merchant_id, amount, currency, receipt, notes, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;
        const values = [orderId, merchantId, amount, currencyCode, receipt, notes, status];
        const result = await pool.query(query, values);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create Order Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

const getOrder = async (req, res) => {
    const { orderId } = req.params;
    // We strictly follow the spec: X-Api-Key/Secret must be present (handled by middleware)

    try {
        const result = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: {
                    code: 'NOT_FOUND_ERROR',
                    description: 'Order not found'
                }
            });
        }

        const order = result.rows[0];
        // Check ownership
        if (req.merchant && order.merchant_id !== req.merchant.id) {
            return res.status(404).json({
                error: {
                    code: 'NOT_FOUND_ERROR',
                    description: 'Order not found'
                }
            });
        }

        res.status(200).json(order);
    } catch (err) {
        console.error('Get Order Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

const getOrderPublic = async (req, res) => {
    const { orderId } = req.params;
    try {
        const result = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: {
                    code: 'NOT_FOUND_ERROR',
                    description: 'Order not found'
                }
            });
        }

        const order = result.rows[0];
        // Return limited fields
        res.status(200).json({
            id: order.id,
            amount: order.amount,
            currency: order.currency,
            status: order.status
        });
    } catch (err) {
        console.error('Get Public Order Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = {
    createOrder,
    getOrder,
    getOrderPublic
};
