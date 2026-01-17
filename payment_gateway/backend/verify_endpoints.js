const http = require('http');

const API_BASE = 'http://localhost:8000/api/v1';

// Helper for requests
function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 8000,
            path: `/api/v1${path}`,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                let parsed = data;
                try { parsed = JSON.parse(data); } catch (e) { }
                resolve({ status: res.statusCode, data: parsed });
            });
        });

        req.on('error', reject);

        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function runTests() {
    console.log('Starting Verification...');

    // 1. Get Test Merchant
    console.log('\n[1] Testing Public Merchant Endpoint...');
    const merchRes = await request('GET', '/test/merchant');
    if (merchRes.status === 200 && merchRes.data.email === 'test@example.com') {
        console.log('✅ Success: Found test merchant');
    } else {
        console.error('❌ Failed:', merchRes.status, merchRes.data);
        return;
    }

    const API_KEY = merchRes.data.api_key;
    const MERCHANT_ID = merchRes.data.id;

    // 2. Create Order (Authenticated)
    console.log('\n[2] Creating Order (Auth)...');
    const orderRes = await request('POST', '/orders', {
        amount: 25000,
        currency: 'INR',
        receipt: 'rcpt_verify_1'
    }, {
        'x-api-key': API_KEY,
        'x-api-secret': 'secret_test_xyz789',
        'x-merchant-id': MERCHANT_ID
    });

    if (orderRes.status !== 201) {
        console.error('❌ Failed to create order. Status:', orderRes.status);
        console.log('Response:', orderRes.data);
        return;
    }
    const ORDER_ID = orderRes.data.id;
    console.log('✅ Order Created:', ORDER_ID);

    // 3. Public Order Fetch
    console.log('\n[3] Testing Public Order Fetch...');
    const pubOrderRes = await request('GET', `/orders/${ORDER_ID}/public`);
    if (pubOrderRes.status === 200 && pubOrderRes.data.id === ORDER_ID) {
        console.log('✅ Success: Fetched public order');
    } else {
        console.error('❌ Failed public order fetch:', pubOrderRes.status);
    }

    // 4. Public Payment (Valid)
    console.log('\n[4] Testing Public Payment (Valid Card)...');
    const payRes = await request('POST', '/payments/public', {
        order_id: ORDER_ID,
        method: 'card',
        card: {
            number: '4242424242424242', // Luhn valid
            expiry_month: '12',
            expiry_year: '2030',
            cvv: '123'
        }
    });

    if (payRes.status === 201 && payRes.data.status === 'processing') {
        console.log('✅ Success: Created public payment');
    } else {
        console.error('❌ Failed public payment:', payRes.status, payRes.data);
    }

    // 5. Public Payment (Invalid Luhn)
    console.log('\n[5] Testing Invalid Luhn...');
    const failLuhn = await request('POST', '/payments/public', {
        order_id: ORDER_ID,
        method: 'card',
        card: {
            number: '4242424242424241', // Invalid
            expiry_month: '12',
            expiry_year: '2030',
            cvv: '123'
        }
    });

    if (failLuhn.status === 400 && failLuhn.data.error.code === 'INVALID_CARD') {
        console.log('✅ Success: Rejected invalid Luhn');
    } else {
        console.error('❌ Failed: Should have rejected Luhn', failLuhn.status);
    }

    // 6. Public Payment (Expired)
    console.log('\n[6] Testing Expired Card...');
    const failExpiry = await request('POST', '/payments/public', {
        order_id: ORDER_ID,
        method: 'card',
        card: {
            number: '4242424242424242',
            expiry_month: '01',
            expiry_year: '2000', // Expired
            cvv: '123'
        }
    });

    if (failExpiry.status === 400 && failExpiry.data.error.code === 'EXPIRED_CARD') {
        console.log('✅ Success: Rejected expired card');
    } else {
        console.error('❌ Failed: Should have rejected expired', failExpiry.status);
    }

    // 7. Test Mode Verification (Deterministic)
    console.log('\n[7] Testing Deterministic Test Mode (TEST_MODE=true)...');
    const start = Date.now();
    const testModePay = await request('POST', '/payments/public', {
        order_id: ORDER_ID,
        method: 'card',
        card: {
            number: '4242424242424242',
            expiry_month: '12',
            expiry_year: '2030',
            cvv: '123'
        }
    });

    // We expect immediate response (processing) but backend processing takes 1000ms (as per env)
    // We can't easily check backend processing time from client side without polling status change time.
    // But we can check if success is GUARANTEED (TEST_PAYMENT_SUCCESS=true).
    // Let's poll for status.

    if (testModePay.status === 201) {
        const pId = testModePay.data.id;
        console.log(`  Payment created ${pId}. Polling for success (expect ~1s)...`);

        let status = 'processing';
        let attempts = 0;
        while (status === 'processing' && attempts < 10) {
            await new Promise(r => setTimeout(r, 500));
            const pollRes = await request('GET', `/payments/${pId}/public`);
            if (pollRes.status === 200) {
                status = pollRes.data.status;
            }
            attempts++;
        }

        if (status === 'success') {
            console.log('✅ Success: Payment became success (Test Mode Active)');
        } else {
            console.error('❌ Failed: Payment did not become success. Status:', status);
        }
    }

    // 8. Dashboard Stats
    console.log('\n[8] Testing Dashboard Stats...');
    const statsRes = await request('GET', '/payments/dashboard-stats', null, {
        'x-api-key': API_KEY,
        'x-api-secret': 'secret_test_xyz789',
        'x-merchant-id': MERCHANT_ID
    });

    if (statsRes.status === 200 && statsRes.data.total_transactions !== undefined) {
        console.log('✅ Success: Fetched stats', statsRes.data);
    } else {
        console.error('❌ Failed stats:', statsRes.status, JSON.stringify(statsRes.data));
    }

    console.log('\nVerification Complete.');
}

runTests();
