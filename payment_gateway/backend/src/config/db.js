const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

pool.on('connect', () => {
    console.log('Connected to the database');
});

const query = (text, params) => pool.query(text, params);

const initDb = async (retries = 5, delay = 2000) => {
    while (retries > 0) {
        try {
            const schemaPath = path.join(__dirname, '../resources/schema.sql');
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
            await query(schemaSql);
            console.log('Database schema initialized and seeded.');
            return;
        } catch (err) {
            console.error(`Error initializing database (retries left: ${retries}):`, err.message);
            retries -= 1;
            if (retries === 0) {
                console.error('Failed to initialize database after multiple attempts.');
                process.exit(1); // Exit if DB init fails strictly
            }
            await new Promise(res => setTimeout(res, delay));
        }
    }
};

module.exports = {
    query,
    pool,
    initDb
};
