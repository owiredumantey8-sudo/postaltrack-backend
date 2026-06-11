const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'owiredumantey8@gmail.com',
    pass: 'yklmepxcettjvhnf'
  }
});

// Manual email send (used by admin panel)
router.post('/send-email', async (req, res) => {
  const { to, subject, text } = req.body;
  if (!to || !subject || !text) {
    return res.status(400).json({ message: 'to, subject and text are required' });
  }
  try {
    await transporter.sendMail({
      from: '"PostalTrack 📦" <owiredumantey8@gmail.com>',
      to,
      subject,
      text,
      html: `<p>${text.replace(/\n/g, '<br>')}</p>`
    });
    res.json({ message: 'Email sent successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;