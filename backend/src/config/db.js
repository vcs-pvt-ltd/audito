const mysql = require('mysql2');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const db = pool.promise();

const connectDB = async () => {
  try {
    const connection = await db.getConnection();
    console.log(`MySQL Database Connected: ${process.env.DB_NAME}`);
    connection.release();
  } catch (error) {
    console.error('MySQL connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = { db, connectDB };
