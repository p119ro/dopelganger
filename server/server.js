'use strict';

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const path = require('path');

const { prisma } = require('./services/db');
const { redis } = require('./services/cache');
const { initSockets } = require('./sockets');
const { startCronJobs } = require('./services/cronJobs');

const authRoutes = require('./routes/auth');
const habitRoutes = require('./routes/habits');
const teamRoutes = require('./routes/teams');
const battleRoutes = require('./routes/battles');
const leaderboardRoutes = require('./routes/leaderboard');
const adminRoutes = require('./routes/admin');

const { generalLimiter } = require('./middleware/rateLimit');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const httpServer = http.createServer(app);

// ─── CORS ───────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',').map(s => s.trim()).filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, mobile apps, same-origin server calls)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin not allowed — ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
};

// ─── SOCKET.IO ──────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
});

// Make io available to routes/services
app.set('io', io);

// ─── MIDDLEWARE ──────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Disable for dev; tighten in prod
  crossOriginEmbedderPolicy: false,
}));
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// ─── STATIC FILES ────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../client')));
app.use('/favicon_io', express.static(path.join(__dirname, '../favicon_io')));

// ─── HEALTH CHECK ────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  let dbStatus = 'disconnected';
  let redisStatus = 'disconnected';

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch {}

  try {
    await redis.ping();
    redisStatus = 'connected';
  } catch {}

  const uptime = Math.floor(process.uptime());
  res.json({ status: 'ok', db: dbStatus, redis: redisStatus, uptime: `${uptime}s` });
});

// ─── API ROUTES ──────────────────────────────────────────────────────────────
app.use('/api', generalLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/habits', habitRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/battles', battleRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/admin', adminRoutes);

// ─── CATCH-ALL → SPA ─────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// ─── ERROR HANDLER ───────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── INIT ─────────────────────────────────────────────────────────────────────
initSockets(io);
startCronJobs(io);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`[server] Doppelganger running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

// ─── GRACEFUL SHUTDOWN ───────────────────────────────────────────────────────
const shutdown = async (signal) => {
  console.log(`[server] ${signal} received — shutting down`);
  httpServer.close(async () => {
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { app, io };
