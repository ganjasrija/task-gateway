import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import "./Dashboard.css";

const Dashboard = () => {
    const navigate = useNavigate();
    const [merchant, setMerchant] = useState(null);
    const [stats, setStats] = useState({ totalTransactions: 0, totalAmount: 0, successRate: '0%' });

    useEffect(() => {
        const fetchMerchantAndStats = async () => {
            try {
                // 1. Fetch Merchant
                const res = await fetch('http://localhost:8000/api/v1/test/merchant');
                if (res.ok) {
                    const data = await res.json();
                    setMerchant(data);

                    // 2. Fetch Stats using merchant credentials
                    const statsRes = await fetch('http://localhost:8000/api/v1/payments/dashboard-stats', {
                        headers: {
                            'x-api-key': data.api_key,
                            'x-api-secret': data.api_secret
                        }
                    });

                    if (statsRes.ok) {
                        const statsData = await statsRes.json();
                        setStats({
                            totalTransactions: statsData.total_transactions,
                            totalAmount: statsData.total_amount / 100,
                            successRate: statsData.success_rate + '%'
                        });
                    }
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchMerchantAndStats();
    }, []);

    return (
        <div data-test-id="dashboard" className="dashboard">
            <h1 className="dashboard-title">Merchant Dashboard</h1>

            {merchant && (
                <div data-test-id="api-credentials" className="credentials">
                    <div className="credential-card">
                        <label>API Key</label>
                        <span data-test-id="api-key" className="credential-value">
                            {merchant.api_key}
                        </span>
                    </div>

                    <div className="credential-card">
                        <label>API Secret</label>
                        <span data-test-id="api-secret" className="credential-value">
                            {merchant.api_secret}
                        </span>
                    </div>
                </div>
            )}

            <div data-test-id="stats-container" className="stats">
                <div className="stat-card">
                    <div className="stat-label">Total Transactions</div>
                    <div data-test-id="total-transactions" className="stat-value">
                        {stats.totalTransactions}
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-label">Total Amount</div>
                    <div data-test-id="total-amount" className="stat-value">
                        ₹{stats.totalAmount}
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-label">Success Rate</div>
                    <div data-test-id="success-rate" className="stat-value">
                        {stats.successRate}
                    </div>
                </div>
            </div>

            <button
                data-test-id="view-transactions-button"
                className="login-button"
                style={{ marginTop: '30px', maxWidth: '200px' }}
                onClick={() => navigate('/dashboard/transactions')}
            >
                View Transactions
            </button>
            <button
  className="login-button"
  style={{ marginTop: "15px", maxWidth: "200px" }}
  onClick={() => navigate("/dashboard/webhooks")}
>
  Webhook Logs
</button>

        </div>
    );
};

export default Dashboard;
