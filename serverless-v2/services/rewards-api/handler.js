'use strict';

const express = require('express');
const serverless = require('serverless-http');

const healthRoute = require('./src/routes/health');
const pointsRoute = require('./src/routes/points');
const playerRoute = require('./src/routes/player');
const leaderboardRoute = require('./src/routes/leaderboard');
const notificationsRoute = require('./src/routes/notifications');
const adminRoute = require('./src/routes/admin');
const { authMiddleware } = require('./src/middleware/auth');

const app = express();

app.use(express.json());

// CORS for local frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Player-Id, X-Admin-Id');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Public routes
app.use('/api/v1/health', healthRoute);

// Protected routes (require X-Player-Id header)
app.use('/api/v1/points', authMiddleware, pointsRoute);
app.use('/api/v1/player', authMiddleware, playerRoute);
app.use('/api/v1/leaderboard', authMiddleware, leaderboardRoute);
app.use('/api/v1/player/notifications', authMiddleware, notificationsRoute);

// Admin routes (no auth guard for the challenge — stub)
app.use('/admin', adminRoute);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

module.exports.api = serverless(app);
