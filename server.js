const settingsRoutes = require('./routes/settings');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const db = require('./db');
const authRoutes = require('./routes/auth');
const parcelRoutes = require('./routes/parcels');
const notificationRoutes = require('./routes/notifications');
const agentsRouter = require('./routes/agents');
const profileRouter = require('./routes/profile');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/parcels', parcelRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/agents', agentsRouter);
app.use('/api/profile', profileRouter);
app.use('/api/settings', settingsRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Postal & Courier Tracking System API is running!' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Connected to MySQL database successfully!`);
});