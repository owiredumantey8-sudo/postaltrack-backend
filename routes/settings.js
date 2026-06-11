const express = require('express');
const router = express.Router();
const db = require('../db');

// GET settings
router.get('/', (req, res) => {
    const sql = 'SELECT setting_key, setting_value FROM system_settings';
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Settings fetch error:", err);
            return res.status(500).json({ error: 'Failed to fetch settings' });
        }
        
        const settingsObj = {
            auto_email_dispatch: false,
            auto_email_delivered: false,
            require_agent_location: false
        };

        results.forEach(row => {
            if (settingsObj.hasOwnProperty(row.setting_key)) {
                settingsObj[row.setting_key] = Boolean(row.setting_value);
            }
        });
        
        res.json(settingsObj);
    });
});

// UPDATE setting
router.put('/', (req, res) => {
    const { key, value } = req.body;

    const validKeys = ['auto_email_dispatch', 'auto_email_delivered', 'require_agent_location'];
    if (!validKeys.includes(key)) {
        return res.status(400).json({ error: 'Invalid setting key' });
    }

    const dbValue = value ? 1 : 0;
    const sql = 'UPDATE system_settings SET setting_value = ? WHERE setting_key = ?';

    db.query(sql, [dbValue, key], (err) => {
        if (err) {
            console.error("Settings update error:", err);
            return res.status(500).json({ error: 'Failed to update setting' });
        }
        
        res.json({ message: 'Setting updated successfully' });
    });
});

module.exports = router;