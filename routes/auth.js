const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const nodemailer = require('nodemailer');

/* ── Email transporter ── */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'owiredumantey8@gmail.com',
    pass: 'yklmepxcettjvhnf'
  }
});
 
const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: '"PostalTrack 📦" <owiredumantey8@gmail.com>',
      to, subject, html,
    });
    console.log(`✉️  Email sent to ${to}`);
  } catch (err) {
    console.error(`❌ Email failed:`, err.message);
  }
};

// In-memory store for reset tokens
const resetTokens = {};

/* ========================= REGISTER ========================= */
router.post('/register', (req, res) => {
  const { full_name, email, phone_number, password, role } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);
  const sql = `INSERT INTO users (full_name, email, phone_number, password_hash, role) VALUES (?, ?, ?, ?, ?)`;
  db.query(sql, [full_name, email, phone_number, hashedPassword, role || 'customer'], (err) => {
    if (err) return res.status(500).json({ message: err.message });
    res.status(201).json({ message: 'User registered successfully!' });
  });
});

/* ========================= LOGIN ========================= */
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const sql = 'SELECT * FROM users WHERE email = ?';
  db.query(sql, [email], (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'User not found' });
    const user = results[0];
    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: 'Wrong password' });
    const token = jwt.sign({ id: user.user_id, role: user.role }, 'secret123', { expiresIn: '1d' });
    if (user.role === 'courier_agent') {
      const agentSql = 'SELECT agent_id, agent_name FROM courier_agents WHERE user_id = ?';
      db.query(agentSql, [user.user_id], (err2, agentResults) => {
        if (err2) return res.status(500).json({ message: err2.message });
        if (agentResults.length === 0) return res.status(404).json({ message: 'Agent profile not found' });
        const agent = agentResults[0];
        res.json({ message: 'Login successful!', token, role: user.role, agent_id: agent.agent_id, name: agent.agent_name });
      });
    } else {
      res.json({ message: 'Login successful!', token, role: user.role, name: user.full_name, user_id: user.user_id });
    }
  });
});

/* ========================= FORGOT PASSWORD ========================= */
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  db.query('SELECT user_id, full_name FROM users WHERE email = ?', [email], (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'No account found with that email address' });

    const user = results[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = Date.now() + 1000 * 60 * 30; // 30 minutes
    resetTokens[token] = { userId: user.user_id, expiry };

    console.log(`🔑 Reset token generated for ${email}`);

    const resetUrl = `http://localhost:3000/reset-password?token=${token}`;

    const html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;">
  <div style="max-width:520px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1b4332,#2d6a4f);padding:28px 32px;">
      <h1 style="color:white;margin:0;font-size:22px;">📦 PostalTrack</h1>
      <p style="color:#95d5b2;margin:6px 0 0;font-size:14px;">Password Reset Request</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="color:#374151;font-size:15px;">Hi <strong>${user.full_name}</strong>,</p>
      <p style="color:#374151;font-size:15px;">We received a request to reset your PostalTrack password. Click the button below to set a new password.</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${resetUrl}" style="display:inline-block;background:#2d6a4f;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:700;">
          🔐 Reset My Password
        </a>
      </div>
      <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:12px 16px;margin-top:8px;">
        <p style="color:#a16207;font-size:13px;margin:0;">⏰ This link expires in <strong>30 minutes</strong>. If you did not request this, ignore this email.</p>
      </div>
    </div>
    <div style="background:#f8fafc;padding:16px 32px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">© ${new Date().getFullYear()} PostalTrack · Ghana</p>
    </div>
  </div>
</body></html>`;

    sendEmail(email, '🔐 Reset Your PostalTrack Password', html).then(() => {
      res.json({ message: 'Password reset link sent! Check your email inbox.' });
    }).catch(() => {
      res.status(500).json({ message: 'Failed to send email. Please try again.' });
    });
  });
});

/* ========================= RESET PASSWORD ========================= */
router.post('/reset-password', (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword)
    return res.status(400).json({ message: 'Token and new password are required' });

  const record = resetTokens[token];
  if (!record)
    return res.status(400).json({ message: 'Invalid or already used reset link. Please request a new one.' });

  if (Date.now() > record.expiry) {
    delete resetTokens[token];
    return res.status(400).json({ message: 'This reset link has expired. Please request a new one.' });
  }

  if (newPassword.length < 6)
    return res.status(400).json({ message: 'Password must be at least 6 characters' });

  const hashed = bcrypt.hashSync(newPassword, 10);
  db.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [hashed, record.userId], (err) => {
    if (err) return res.status(500).json({ message: err.message });
    delete resetTokens[token];
    res.json({ message: 'Password updated successfully! You can now log in with your new password.' });
  });
});

/* ========================= GET ALL USERS (Admin) ========================= */
router.get('/users/all', (req, res) => {
  const sql = `SELECT user_id, full_name, email, phone_number, role, created_at FROM users ORDER BY created_at DESC`;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(results);
  });
});

/* ========================= DELETE USER (Admin) ========================= */
router.delete('/users/delete/:id', (req, res) => {
  const { id } = req.params;
  db.query(`SELECT parcel_id FROM parcels WHERE sender_id = ?`, [id], (err, parcels) => {
    if (err) return res.status(500).json({ message: err.message });
    const parcelIds = parcels.map(p => p.parcel_id);
    const deleteEvents = (callback) => {
      if (parcelIds.length === 0) return callback();
      const placeholders = parcelIds.map(() => '?').join(',');
      db.query(`DELETE FROM parcel_events WHERE parcel_id IN (${placeholders})`, parcelIds, (err2) => {
        if (err2) return res.status(500).json({ message: err2.message });
        callback();
      });
    };
    const deleteParcels = (callback) => {
      db.query(`DELETE FROM parcels WHERE sender_id = ?`, [id], (err3) => {
        if (err3) return res.status(500).json({ message: err3.message });
        callback();
      });
    };
    const deleteUser = () => {
      db.query(`DELETE FROM users WHERE user_id = ?`, [id], (err4, result) => {
        if (err4) return res.status(500).json({ message: err4.message });
        if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found' });
        res.json({ message: 'User deleted successfully' });
      });
    };
    deleteEvents(() => deleteParcels(() => deleteUser()));
  });
});

module.exports = router;