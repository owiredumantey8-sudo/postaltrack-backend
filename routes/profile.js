const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');

/* =========================
   GET USER'S PARCELS
   (must be BEFORE /:userId to avoid conflict)
========================= */
router.get('/parcels/:userId', (req, res) => {
  const { userId } = req.params;
  const sql = `
    SELECT p.*, ca.agent_name
    FROM parcels p
    LEFT JOIN courier_agents ca ON p.agent_id = ca.agent_id
    WHERE p.sender_id = ?
    ORDER BY p.parcel_id DESC`;
  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    res.json(results || []);
  });
});

/* =========================
   SUBMIT SUPPORT TICKET (UPDATED)
========================= */
router.post('/support', (req, res) => {
  const { user_id, tracking_number, category, subject, message } = req.body;

  if (!category || !subject || !message) {
    return res.status(400).json({ message: 'Category, subject, and message are required' });
  }

  const sql = `INSERT INTO support_tickets (user_id, tracking_number, category, subject, message, status) VALUES (?, ?, ?, ?, ?, 'pending')`;
  db.query(sql, [user_id || null, tracking_number || null, category, subject, message], (err, result) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    res.status(201).json({
      message: 'Support ticket submitted successfully! We will look into it.',
      ticket_id: result.insertId
    });
  });
});

/* =========================
   ADMIN: GET ALL SUPPORT TICKETS
========================= */
router.get('/support-tickets', (req, res) => {
  const sql = `
    SELECT st.*, u.full_name, u.email as user_email 
    FROM support_tickets st
    LEFT JOIN users u ON st.user_id = u.user_id
    ORDER BY st.created_at DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    res.json(results || []);
  });
});

/* =========================
   ADMIN: RESOLVE A TICKET
========================= */
router.put('/support-tickets/:id/resolve', (req, res) => {
  const sql = `UPDATE support_tickets SET status = 'resolved' WHERE ticket_id = ?`;
  db.query(sql, [req.params.id], (err) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    res.json({ message: 'Ticket marked as resolved.' });
  });
});

/* =========================
   UPDATE PHONE NUMBER
   (must be BEFORE /:userId)
========================= */
router.put('/update-phone/:userId', (req, res) => {
  const { userId } = req.params;
  const { phone_number } = req.body;
  if (!phone_number) return res.status(400).json({ message: 'Phone number is required' });

  const sql = `UPDATE users SET phone_number = ? WHERE user_id = ?`;
  db.query(sql, [phone_number, userId], (err, result) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'Phone number updated successfully' });
  });
});

/* =========================
   CHANGE PASSWORD
   (must be BEFORE /:userId)
========================= */
router.put('/change-password/:userId', (req, res) => {
  const { userId } = req.params;
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password)
    return res.status(400).json({ message: 'Both fields are required' });

  if (new_password.length < 6)
    return res.status(400).json({ message: 'New password must be at least 6 characters' });

  db.query('SELECT password_hash FROM users WHERE user_id = ?', [userId], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (results.length === 0) return res.status(404).json({ message: 'User not found' });

    const isMatch = bcrypt.compareSync(current_password, results[0].password_hash);
    if (!isMatch) return res.status(401).json({ message: 'Current password is incorrect' });

    const newHash = bcrypt.hashSync(new_password, 10);
    db.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [newHash, userId], (err2) => {
      if (err2) return res.status(500).json({ message: 'Database error' });
      res.json({ message: 'Password changed successfully' });
    });
  });
});

/* =========================
   GET USER PROFILE
   (dynamic route — keep LAST)
========================= */
router.get('/:userId', (req, res) => {
  const { userId } = req.params;
  const sql = `SELECT user_id, full_name, email, phone_number, created_at FROM users WHERE user_id = ?`;
  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (results.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json(results[0]);
  });
});

module.exports = router;