const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'bycnexdyfv3kyjoo9cte-mysql.services.clever-cloud.com', // Clever Cloud host
    user: 'uadqauuajey1966b', // Clever Cloud user
    password: '7ULpuXOyAqhV3QHYsHz', // Clever Cloud password
    database: 'bycnexdyfv3kyjoo9cte', // Clever Cloud database name
    port: 20732, // Custom MySQL port for Clever Cloud
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('Database connection to Clever Cloud successful!');
        connection.release();
    } catch (error) {
        console.error('Database connection failed:', error.message);
    }
}

testConnection();

module.exports = pool;
