const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'bvfufyxews7frt7jzwjz-mysql.services.clever-cloud.com',
    user: 'upuzrqrv0s0r93xo',
    password: 'ahmlqYc4ewhkWEvkjoQ',
    database: 'bvfufyxews7frt7jzwjz',
    port: 20805, // Clever Cloud uses a custom port
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0
});

async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('Database connection successful!');
        connection.release();
    } catch (error) {
        console.error('Database connection failed:', error.message);
    }
}

testConnection();

module.exports = pool;
