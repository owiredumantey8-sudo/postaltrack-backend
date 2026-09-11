const express = require('express');
const router = express.Router();
const db = require('../db');
const nodemailer = require('nodemailer');
const verifyToken = require('../middleware/auth');

/* ── Email transporter ── */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465, // true for port 465, false for 587/others
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const emailsSent = new Set();

const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'PostalTrack <no-reply@postaltrack.com>',
      to,
      subject,
      html
    });
    console.log(`Email sent successfully to ${to}`);
  } catch (err) {
    console.error(`Email failed:`, err.message);
  }
};

const frontendUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.trim() : 'https://postaltrack-frontend.vercel.app';

const bookingConfirmationHTML = (senderName, trackingNumber, recipientName, address) => `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1b4332,#2d6a4f);padding:28px 32px;">
      <h1 style="color:white;margin:0;font-size:22px;">📦 PostalTrack</h1>
      <p style="color:#95d5b2;margin:6px 0 0;font-size:14px;">Parcel Booking Confirmed</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="color:#374151;font-size:15px;">Hi <strong>${senderName}</strong>,</p>
      <p style="color:#374151;font-size:15px;">Your parcel has been booked successfully! Here are the details:</p>
      <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:18px 22px;margin:20px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="color:#6b7280;font-size:13px;padding:6px 0;font-weight:600;">TRACKING NUMBER</td>
              <td style="color:#065f46;font-size:15px;font-weight:800;font-family:monospace;text-align:right;">${trackingNumber}</td></tr>
          <tr><td style="color:#6b7280;font-size:13px;padding:6px 0;font-weight:600;">RECIPIENT</td>
              <td style="color:#111827;font-size:14px;font-weight:600;text-align:right;">${recipientName}</td></tr>
          <tr><td style="color:#6b7280;font-size:13px;padding:6px 0;font-weight:600;">DELIVERY ADDRESS</td>
              <td style="color:#374151;font-size:13px;text-align:right;">${address}</td></tr>
          <tr><td style="color:#6b7280;font-size:13px;padding:6px 0;font-weight:600;">STATUS</td>
              <td style="text-align:right;"><span style="background:#fef9c3;color:#a16207;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;">Booked</span></td></tr>
        </table>
      </div>
      <p style="color:#374151;font-size:14px;margin-top:24px;">Thank you for using <strong>PostalTrack</strong> 🚀</p>
    </div>
  </div>
</body></html>`;

const recipientNotificationHTML = (recipientName, trackingNumber, senderName, address) => `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:28px 32px;">
      <h1 style="color:white;margin:0;font-size:22px;">📦 PostalTrack</h1>
      <p style="color:#bfdbfe;margin:6px 0 0;font-size:14px;">A parcel is heading your way!</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="color:#374151;font-size:15px;">Hi <strong>${recipientName}</strong>,</p>
      <p style="color:#374151;font-size:15px;"><strong>${senderName || 'Someone'}</strong> has sent you a parcel via PostalTrack.</p>
      <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:10px;padding:18px 22px;margin:20px 0;">
        <p style="color:#6b7280;font-size:12px;font-weight:700;margin:0 0 6px;">YOUR TRACKING NUMBER</p>
        <p style="color:#1d4ed8;font-size:22px;font-weight:800;font-family:monospace;margin:0;">${trackingNumber}</p>
        <p style="color:#374151;font-size:13px;margin:10px 0 0;">📍 Delivery to: ${address}</p>
      </div>
      <div style="text-align:center;margin:24px 0 8px;">
        <a href="${frontendUrl}/track/${trackingNumber}" style="display:inline-block;background:#1d4ed8;color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:800;">
          📍 Track Your Parcel
        </a>
      </div>
      <p style="color:#6b7280;font-size:12px;text-align:center;margin-top:8px;">
        Or click here: <a href="${frontendUrl}/track/${trackingNumber}" style="color:#1d4ed8;">${frontendUrl}/track/${trackingNumber}</a>
      </p>
    </div>
  </div>
</body></html>`;

/* ========================= BOOK PARCEL ========================= */
router.post('/book', (req, res) => {
  const {
    sender_id, recipient_name, recipient_phone,
    destination_address, recipient_email, weight_kg, declared_value
  } = req.body;

  const deliveryAddress = destination_address || req.body.recipient_address || '';
  const trackingNumber = 'TRK' + Math.floor(Math.random() * 1000000000000);

  const sql = `
    INSERT INTO parcels
      (sender_id, tracking_number, recipient_name, recipient_phone,
       destination_address, recipient_address, recipient_email, weight_kg, declared_value, current_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'booked')`;

  db.query(sql,
    [sender_id, trackingNumber, recipient_name, recipient_phone,
     deliveryAddress, deliveryAddress, recipient_email, weight_kg || 0, declared_value || 0],
    (err) => {
      if (err) {
        console.error('Book parcel error:', err.message);
        return res.status(500).json({ message: 'Database error: ' + err.message });
      }

      res.json({ message: 'Parcel booked successfully', tracking_number: trackingNumber });
      sendBookingEmails(sender_id, trackingNumber, recipient_name, recipient_email, deliveryAddress);
    }
  );
});

function sendBookingEmails(sender_id, trackingNumber, recipient_name, recipient_email, deliveryAddress) {
  if (emailsSent.has(trackingNumber)) return;
  emailsSent.add(trackingNumber);
  setTimeout(() => emailsSent.delete(trackingNumber), 10 * 60 * 1000);

  db.query('SELECT email, full_name FROM users WHERE user_id = ?', [sender_id], (err, userRes) => {
    if (err) return;
    const senderName = userRes?.[0]?.full_name || 'Customer';
    const senderEmail = userRes?.[0]?.email;

    if (senderEmail) {
      sendEmail(senderEmail, `✅ Booking Confirmed – ${trackingNumber}`, bookingConfirmationHTML(senderName, trackingNumber, recipient_name, deliveryAddress));
    }
    if (recipient_email && recipient_email.toLowerCase() !== senderEmail?.toLowerCase()) {
      sendEmail(recipient_email, `📦 A parcel is on its way to you – ${trackingNumber}`, recipientNotificationHTML(recipient_name, trackingNumber, senderName, deliveryAddress));
    }
  });
}

router.get('/all', verifyToken, (req, res) => {
  db.query(`SELECT * FROM parcels ORDER BY parcel_id DESC`, (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(results || []);
  });
});

router.put('/assign/:parcelId', (req, res) => {
  const { parcelId } = req.params;
  const { agent_id } = req.body;
  db.query(`UPDATE parcels SET agent_id = ? WHERE parcel_id = ?`, [agent_id || null, parcelId], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Parcel not found' });
    res.json({ message: agent_id ? 'Agent assigned successfully' : 'Agent unassigned' });
  });
});

router.get('/agent/:agentId', (req, res) => {
  db.query(`SELECT * FROM parcels WHERE agent_id = ? ORDER BY parcel_id DESC`, [req.params.agentId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results || []);
  });
});

router.get('/my-parcels/:userId', (req, res) => {
  db.query(`SELECT * FROM parcels WHERE sender_id = ? ORDER BY parcel_id DESC`, [req.params.userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results || []);
  });
});

router.put('/update/:id', (req, res) => {
  const { id } = req.params;
  const { current_status, current_location, description } = req.body;
  db.query(`UPDATE parcels SET current_status = ?, current_location = ?, description = ? WHERE parcel_id = ?`,
    [current_status, current_location, description, id], (err) => {
      if (err) return res.status(500).json({ message: err.message });
      db.query(`INSERT INTO parcel_events (parcel_id, status_code, location, event_description, event_timestamp) VALUES (?, ?, ?, ?, NOW())`,
        [id, current_status, current_location, description], () => {});
      res.json({ message: 'Parcel updated successfully' });
    });
});

router.get('/track/:trackingNumber', (req, res) => {
  db.query(`SELECT * FROM parcels WHERE tracking_number = ?`, [req.params.trackingNumber], (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    if (results.length === 0) return res.status(404).json({ error: 'Parcel not found' });
    res.json(results[0]);
  });
});

router.get('/events/:parcelId', (req, res) => {
  db.query(`SELECT * FROM parcel_events WHERE parcel_id = ? ORDER BY event_timestamp DESC`, [req.params.parcelId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results || []);
  });
});

router.delete('/delete/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  db.query(`DELETE FROM parcel_events WHERE parcel_id = ?`, [id], () => {
    db.query(`DELETE FROM parcels WHERE parcel_id = ?`, [id], (err2) => {
      if (err2) return res.status(500).json({ message: 'Database error' });
      res.json({ message: 'Parcel deleted successfully' });
    });
  });
});

module.exports = router;