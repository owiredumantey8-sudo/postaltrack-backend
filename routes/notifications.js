const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

const senderEmail = process.env.EMAIL_USER ? process.env.EMAIL_USER.trim() : 'owiredumantey8@gmail.com';
const senderPass = process.env.EMAIL_PASS ? process.env.EMAIL_PASS.trim() : 'yklmepxcettjvhnf';

/* ── Email transporter (IPv4 forced for Render) ── */
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: senderEmail,
    pass: senderPass
  },
  family: 4
});

// Manual email send (used by agent/admin portal)
router.post('/send-email', async (req, res) => {
  const { to, subject, text } = req.body;
  if (!to || !subject || !text) {
    return res.status(400).json({ message: 'to, subject and text are required' });
  }
  try {
    await transporter.sendMail({
      from: `"PostalTrack 📦" <${senderEmail}>`,
      to,
      subject,
      text,
      html: `<p>${text.replace(/\n/g, '<br>')}</p>`
    });
    console.log(`✉️ Manual email sent successfully to ${to}`);
    res.json({ message: 'Email sent successfully!' });
  } catch (err) {
    console.error(`❌ Manual email failed:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;