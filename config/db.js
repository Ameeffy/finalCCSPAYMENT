const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'bhpzrlhj7mjtfvhfyplq-mysql.services.clever-cloud.com', // Clever Cloud host
    user: 'umgmfcbityflfqlf', // Clever Cloud user
    password: 'MSMiS5GdtVRHAeWnE9sR', // Clever Cloud password
    database: 'bhpzrlhj7mjtfvhfyplq', // Clever Cloud database name
    port: 3306, // Default MySQL port
    waitForConnections: true,
    connectionLimit: 10, // Adjust if needed
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
