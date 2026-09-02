const mysql = require('mysql2');
require('dotenv').config();

const db = mysql.createPool({
  host: process.env.DB_HOST ? process.env.DB_HOST.trim() : '',
  port: process.env.DB_PORT || 17127,
  user: process.env.DB_USER ? process.env.DB_USER.trim() : '',
  password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.trim() : '',
  database: process.env.DB_NAME ? process.env.DB_NAME.trim() : '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: false
  }
});

db.getConnection((err, connection) => {
  if (err) {
    console.error('Database connection failed:', err.message);
    return;
  }
  console.log('Connected to MySQL database successfully!');
  connection.release();
});

module.exports = db;