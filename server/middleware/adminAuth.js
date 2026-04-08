'use strict';

const jwt = require('jsonwebtoken');
const { prisma } = require('../services/db');

async function adminAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = header.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Check isAdmin in DB (not just the JWT claim, in case it was issued before isAdmin was set)
  const user = await prisma.user.findUnique({
    where:  { id: payload.userId },
    select: { isAdmin: true },
  }).catch(() => null);

  if (!user?.isAdmin) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  req.user = payload;
  next();
}

module.exports = adminAuth;
