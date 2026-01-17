import React, { useEffect, useState } from 'react';
import "./Transactions.css";

const Transactions = () => {
    const [transactions, setTransactions] = useState([]);

    useEffect(() => {
        const fetchTransactions = async () => {
            try {
                // 1. Get Credentials
                const merchantRes = await fetch('http://localhost:8000/api/v1/test/merchant');
                if (!merchantRes.ok) throw new Error("Failed to fetch merchant");
                const merchant = await merchantRes.json();

                const apiKey = merchant.api_key;
                const apiSecret = merchant.api_secret || 'secret_test_xyz789';

                // 2. Fetch Transactions
                const res = await fetch('http://localhost:8000/api/v1/payments', {
                    headers: {
                        'X-Api-Key': apiKey,
                        'X-Api-Secret': apiSecret
                    }
                });
                if (res.ok) {
                    const data = await res.json();
                    setTransactions(data);
                }
            } catch (err) {
                console.error("Failed to fetch transactions", err);
            }
        };

        fetchTransactions();
    }, []);

    return (
        <div style={{ padding: '40px' }}>
            <h1 style={{ marginBottom: '20px' }}>Transactions</h1>
            <table data-test-id="transactions-table">
                <thead>
                    <tr>
                        <th>Payment ID</th>
                        <th>Order ID</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Status</th>
                        <th>Created</th>
                    </tr>
                </thead>
                <tbody>
                    {transactions.map((txn) => (
                        <tr key={txn.id} data-test-id="transaction-row" data-payment-id={txn.id}>
                            <td data-test-id="payment-id">{txn.id}</td>
                            <td data-test-id="order-id">{txn.order_id}</td>
                            <td data-test-id="amount">₹{txn.amount / 100}</td>
                            <td data-test-id="method">{txn.method}</td>
                            <td data-test-id="status">{txn.status}</td>
                            <td data-test-id="created-at">{new Date(txn.created_at).toLocaleString()}</td>
                        </tr>
                    ))}
                    {transactions.length === 0 && (
                        <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>No transactions found</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default Transactions;
