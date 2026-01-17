const http = require('http');

function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 8000,
            path: `/api/v1${path}`,
            method: method,
            headers: { 'Content-Type': 'application/json', ...headers }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(JSON.parse(data)));
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function main() {
    try {
        const merchant = await request('GET', '/test/merchant');
        const order = await request('POST', '/orders', {
            amount: 50000, // ₹500.00
            currency: 'INR',
            receipt: 'manual_fix_1'
        }, {
            'x-api-key': merchant.api_key,
            'x-api-secret': merchant.api_secret,
            'x-merchant-id': merchant.id
        });

        console.log('ORDER_ID:' + order.id);
        console.log('LINK:http://localhost:3001/checkout?order_id=' + order.id);
    } catch (e) {
        console.error(e);
    }
}

main();
