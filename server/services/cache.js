'use strict';

const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
  lazyConnect: true,
});

redis.on('error', (err) => {
  // Non-fatal in dev — app runs without Redis (sockets degrade gracefully)
  if (process.env.NODE_ENV !== 'test') {
    console.warn('[redis] connection error:', err.message);
  }
});

module.exports = { redis };
