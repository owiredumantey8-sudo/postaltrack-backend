const express = require('express');
const router = express.Router();
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

// emailsSent tracks tracking numbers already emailed — prevents double-sends if route fires twice
const emailsSent = new Set();

const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: '"PostalTrack 📦" <owiredumantey8@gmail.com>',
      to, subject, html,
      text: html.replace(/<[^>]*>/g, '')
    });
    console.log(`✉️  Email sent to ${to}`);
  } catch (err) {
    console.error(`❌ Email failed:`, err.message);
  }
};

/* ── Email Templates ── */
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
      <p style="color:#6b7280;font-size:13px;">Track your parcel anytime using the tracking number above at <strong>localhost:3000/track/${trackingNumber}</strong></p>
      <p style="color:#374151;font-size:14px;margin-top:24px;">Thank you for using <strong>PostalTrack</strong> 🚀</p>
    </div>
    <div style="background:#f8fafc;padding:16px 32px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">© ${new Date().getFullYear()} PostalTrack · Ghana</p>
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
      <p style="color:#6b7280;font-size:13px;">Use this tracking number to follow your parcel at <strong>localhost:3000/track/${trackingNumber}</strong></p>
      <p style="color:#374151;font-size:14px;margin-top:24px;">PostalTrack Team 🚚</p>
    </div>
    <div style="background:#f8fafc;padding:16px 32px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">© ${new Date().getFullYear()} PostalTrack · Ghana</p>
    </div>
  </div>
</body></html>`;

/* ========================= BOOK PARCEL ========================= */
router.post('/book', (req, res) => {
  const {
    sender_id, recipient_name, recipient_phone,
    destination_address, recipient_email, weight_kg, declared_value
  } = req.body;

  // Use destination_address OR recipient_address — whichever frontend sends
  const deliveryAddress = destination_address || req.body.recipient_address || '';

  const trackingNumber = 'TRK' + Math.floor(Math.random() * 1000000000000);

  const sql = `
    INSERT INTO parcels
      (sender_id, tracking_number, recipient_name, recipient_phone,
       destination_address, recipient_email, weight_kg, declared_value, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`;

  db.query(sql,
    [sender_id, trackingNumber, recipient_name, recipient_phone,
     deliveryAddress, recipient_email, weight_kg || 0, declared_value || 0],
    (err) => {
      if (err) {
        console.error('Book parcel error:', err.message);
        // Try alternate column name if first fails
        const sql2 = `
          INSERT INTO parcels
            (sender_id, tracking_number, recipient_name, recipient_phone,
             recipient_address, recipient_email, weight_kg, declared_value, current_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'booked')`;
        db.query(sql2,
          [sender_id, trackingNumber, recipient_name, recipient_phone,
           deliveryAddress, recipient_email, weight_kg || 0, declared_value || 0],
          (err2) => {
            if (err2) {
              console.error('Book parcel error (retry):', err2.message);
              return res.status(500).json({ message: 'Database error: ' + err2.message });
            }
            res.json({ message: 'Parcel booked successfully', tracking_number: trackingNumber });
            sendBookingEmails(sender_id, trackingNumber, recipient_name, recipient_email, deliveryAddress);
          }
        );
        return;
      }

      // Success — respond immediately, then send emails
      res.json({ message: 'Parcel booked successfully', tracking_number: trackingNumber });
      sendBookingEmails(sender_id, trackingNumber, recipient_name, recipient_email, deliveryAddress);
    }
  );
});

/* ── Sends exactly 1 email to sender + 1 to recipient ── */
function sendBookingEmails(sender_id, trackingNumber, recipient_name, recipient_email, deliveryAddress) {
  // Guard: never send twice for same tracking number (prevents double-click duplicates)
  if (emailsSent.has(trackingNumber)) {
    console.log(`⚠️  Emails already sent for ${trackingNumber} — skipping`);
    return;
  }
  emailsSent.add(trackingNumber);
  // Clean up after 10 minutes to avoid memory growth
  setTimeout(() => emailsSent.delete(trackingNumber), 10 * 60 * 1000);

  db.query('SELECT email, full_name FROM users WHERE user_id = ?', [sender_id], (err, userRes) => {
    if (err) { console.error('User lookup error:', err.message); return; }

    const senderName  = userRes?.[0]?.full_name || 'Customer';
    const senderEmail = userRes?.[0]?.email;

    // Email 1 — Booking confirmation → SENDER (the logged-in customer)
    if (senderEmail) {
      sendEmail(
        senderEmail,
        `✅ Booking Confirmed – ${trackingNumber}`,
        bookingConfirmationHTML(senderName, trackingNumber, recipient_name, deliveryAddress)
      );
    }

    // Email 2 — Notification → RECIPIENT (only if different from sender AND email exists)
    if (recipient_email && recipient_email.toLowerCase() !== senderEmail?.toLowerCase()) {
      sendEmail(
        recipient_email,
        `📦 A parcel is on its way to you – ${trackingNumber}`,
        recipientNotificationHTML(recipient_name, trackingNumber, senderName, deliveryAddress)
      );
    }
  });
}

/* ========================= GET ALL PARCELS ========================= */
router.get('/all', (req, res) => {
  const sql = `SELECT * FROM parcels ORDER BY parcel_id DESC`;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(results || []);
  });
});

/* ========================= ASSIGN AGENT ========================= */
router.put('/assign/:parcelId', (req, res) => {
  const { parcelId } = req.params;
  const { agent_id } = req.body;
  db.query(
    `UPDATE parcels SET agent_id = ? WHERE parcel_id = ?`,
    [agent_id || null, parcelId],
    (err, result) => {
      if (err) return res.status(500).json({ message: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Parcel not found' });
      res.json({ message: agent_id ? 'Agent assigned successfully' : 'Agent unassigned' });
    }
  );
});

/* ========================= GET PARCELS FOR SPECIFIC AGENT ========================= */
router.get('/agent/:agentId', (req, res) => {
  const { agentId } = req.params;
  db.query(
    `SELECT * FROM parcels WHERE agent_id = ? ORDER BY parcel_id DESC`,
    [agentId],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(results || []);
    }
  );
});

/* ========================= GET PARCELS FOR SPECIFIC USER ========================= */
router.get('/my-parcels/:userId', (req, res) => {
  const { userId } = req.params;
  db.query(
    `SELECT * FROM parcels WHERE sender_id = ? ORDER BY parcel_id DESC`,
    [userId],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(results || []);
    }
  );
});

/* ========================= UPDATE PARCEL STATUS ========================= */
router.put('/update/:id', (req, res) => {
  const { id } = req.params;
  const { current_status, current_location, description } = req.body;

  db.query(
    `UPDATE parcels SET current_status = ?, current_location = ?, description = ? WHERE parcel_id = ?`,
    [current_status, current_location, description, id],
    (err) => {
      if (err) return res.status(500).json({ message: err.message });

      db.query(
        `INSERT INTO parcel_events (parcel_id, status_code, location, event_description, event_timestamp)
         VALUES (?, ?, ?, ?, NOW())`,
        [id, current_status, current_location, description],
        (err2) => { if (err2) console.error('Event log error:', err2); }
      );

      res.json({ message: 'Parcel updated successfully' });
    }
  );
});

/* ========================= TRACK PARCEL ========================= */
router.get('/track/:trackingNumber', (req, res) => {
  const { trackingNumber } = req.params;
  db.query(`SELECT * FROM parcels WHERE tracking_number = ?`, [trackingNumber], (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    if (results.length === 0) return res.status(404).json({ error: 'Parcel not found' });
    res.json(results[0]);
  });
});

/* ========================= GET PARCEL EVENTS/HISTORY ========================= */
router.get('/events/:parcelId', (req, res) => {
  const { parcelId } = req.params;
  db.query(
    `SELECT * FROM parcel_events WHERE parcel_id = ? ORDER BY event_timestamp DESC`,
    [parcelId],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(results || []);
    }
  );
});

/* ========================= DELETE PARCEL ========================= */
router.delete('/delete/:id', (req, res) => {
  const { id } = req.params;
  db.query(`DELETE FROM parcel_events WHERE parcel_id = ?`, [id], () => {
    db.query(`DELETE FROM parcels WHERE parcel_id = ?`, [id], (err2) => {
      if (err2) return res.status(500).json({ message: 'Database error' });
      res.json({ message: 'Parcel deleted successfully' });
    });
  });
});

module.exports = router;