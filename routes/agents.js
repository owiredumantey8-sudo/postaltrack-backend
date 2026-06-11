const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
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
    await transporter.sendMail({ from: '"PostalTrack 📦" <owiredumantey8@gmail.com>', to, subject, html });
    console.log(`✉️  Email sent to ${to}`);
  } catch (err) {
    console.error(`❌ Email failed:`, err.message);
  }
};

const welcomeEmailHTML = (agentName, email, password, region) => `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;">
  <div style="max-width:580px;margin:0 auto;background:white;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#065f46,#059669);padding:32px;">
      <h1 style="color:white;margin:0;font-size:24px;">📦 PostalTrack</h1>
      <p style="color:#a7f3d0;margin:6px 0 0;font-size:14px;">Courier Agent Portal — Welcome</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#111827;font-size:16px;">Hi <strong>${agentName}</strong>, 👋</p>
      <p style="color:#374151;font-size:14px;">
        You have been added as a <strong>Courier Agent</strong> on PostalTrack.
        Log in to your portal to view and manage your assigned parcels.
      </p>
      <div style="background:#f0fdf4;border:2px solid #86efac;border-radius:12px;padding:20px 24px;margin:24px 0;">
        <p style="color:#065f46;font-size:13px;font-weight:800;margin:0 0 14px;letter-spacing:1px;">🔐 YOUR LOGIN CREDENTIALS</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="color:#6b7280;font-size:13px;padding:8px 0;font-weight:600;width:40%;">Portal URL</td>
            <td style="color:#059669;font-size:13px;font-weight:800;"><a href="http://localhost:3001" style="color:#059669;">http://localhost:3001</a></td>
          </tr>
          <tr style="border-top:1px solid #dcfce7;">
            <td style="color:#6b7280;font-size:13px;padding:8px 0;font-weight:600;">Email</td>
            <td style="color:#111827;font-size:13px;font-weight:700;">${email}</td>
          </tr>
          <tr style="border-top:1px solid #dcfce7;">
            <td style="color:#6b7280;font-size:13px;padding:8px 0;font-weight:600;">Password</td>
            <td style="color:#111827;font-size:16px;font-weight:800;font-family:monospace;">${password}</td>
          </tr>
          <tr style="border-top:1px solid #dcfce7;">
            <td style="color:#6b7280;font-size:13px;padding:8px 0;font-weight:600;">Assigned Region</td>
            <td style="color:#111827;font-size:13px;font-weight:700;">📍 ${region}</td>
          </tr>
        </table>
      </div>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;margin-bottom:24px;">
        <p style="color:#92400e;font-size:13px;margin:0;">⚠️ <strong>Keep your password safe.</strong> Contact your admin if you have trouble logging in.</p>
      </div>
      <div style="text-align:center;">
        <a href="http://localhost:3001" style="display:inline-block;background:#059669;color:white;padding:14px 36px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:800;">🚚 Go to Agent Portal</a>
      </div>
    </div>
    <div style="background:#f8fafc;padding:16px 32px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">© ${new Date().getFullYear()} PostalTrack · Ghana</p>
    </div>
  </div>
</body></html>`;

/* ========================= GET ALL AGENTS ========================= */
router.get('/all', (req, res) => {
  const sql = `
    SELECT ca.agent_id, ca.agent_name, ca.assigned_region,
           u.email, u.phone_number, u.created_at,
           COUNT(p.parcel_id) as parcel_count
    FROM courier_agents ca
    LEFT JOIN users u ON ca.user_id = u.user_id
    LEFT JOIN parcels p ON p.agent_id = ca.agent_id
    GROUP BY ca.agent_id
    ORDER BY ca.agent_name ASC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    res.json(results || []);
  });
});

/* ========================= ADD AGENT ========================= */
router.post('/add', (req, res) => {
  const { full_name, email, phone, password, assigned_region } = req.body;

  if (!full_name || !email || !password || !assigned_region)
    return res.status(400).json({ message: 'All fields are required' });

  db.query('SELECT user_id FROM users WHERE email = ?', [email], (err, existing) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (existing.length > 0) return res.status(400).json({ message: 'Email already exists' });

    const hashedPassword = bcrypt.hashSync(password, 10);

    const userSql = `INSERT INTO users (full_name, email, phone_number, password_hash, role) VALUES (?, ?, ?, ?, 'courier_agent')`;
    db.query(userSql, [full_name, email, phone || null, hashedPassword], (err2, userResult) => {
      if (err2) return res.status(500).json({ message: 'Database error' });

      const userId = userResult.insertId;

      const agentSql = `INSERT INTO courier_agents (agent_name, user_id, assigned_region) VALUES (?, ?, ?)`;
      db.query(agentSql, [full_name, userId, assigned_region], (err3, agentResult) => {
        if (err3) {
          // Rollback user creation
          db.query('DELETE FROM users WHERE user_id = ?', [userId], () => {});
          return res.status(500).json({ message: 'Database error' });
        }

        // Respond immediately
        res.status(201).json({ message: 'Agent added successfully!', agent_id: agentResult.insertId });

        // Send welcome email (fire and forget — won't block the response)
        sendEmail(
          email,
          '🚚 Welcome to PostalTrack — Your Agent Login Details',
          welcomeEmailHTML(full_name, email, password, assigned_region)
        );
      });
    });
  });
});

/* ========================= DELETE AGENT ========================= */
router.delete('/delete/:agentId', (req, res) => {
  const { agentId } = req.params;

  db.query('SELECT user_id FROM courier_agents WHERE agent_id = ?', [agentId], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (results.length === 0) return res.status(404).json({ message: 'Agent not found' });

    const userId = results[0].user_id;

    db.query('UPDATE parcels SET agent_id = NULL WHERE agent_id = ?', [agentId], (err2) => {
      if (err2) return res.status(500).json({ message: 'Database error' });

      db.query('DELETE FROM courier_agents WHERE agent_id = ?', [agentId], (err3) => {
        if (err3) return res.status(500).json({ message: 'Database error' });

        db.query('DELETE FROM users WHERE user_id = ?', [userId], (err4) => {
          if (err4) return res.status(500).json({ message: 'Database error' });
          res.json({ message: 'Agent deleted successfully' });
        });
      });
    });
  });
});

module.exports = router;