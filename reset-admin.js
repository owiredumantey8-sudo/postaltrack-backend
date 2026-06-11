const bcrypt = require('bcryptjs');
const db = require('./db');

const email = 'admin@postal.com';
const newPassword = 'admin123';

bcrypt.hash(newPassword, 10).then(hash => {
  db.query('UPDATE users SET password_hash = ? WHERE email = ?', [hash, email], (err, result) => {
    if (err) {
      console.error('Error:', err);
      return;
    }
    console.log('Rows affected:', result.affectedRows);
    if (result.affectedRows === 0) {
      console.log('User not found!');
    } else {
      console.log('Password updated successfully!');
      console.log('New hash:', hash);
    }
    process.exit();
  });
});