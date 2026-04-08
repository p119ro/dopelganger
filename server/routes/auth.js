'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { z } = require('zod');
const { prisma } = require('../services/db');
const authMiddleware = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { getTier } = require('../services/pointsService');

const router = express.Router();

const REFRESH_COOKIE = 'dg_refresh';

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only'),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function issueAccessToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username, tier: user.tier },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
}

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/auth',
  });
}

// ─── REGISTER ─────────────────────────────────────────────────────────────────
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(data.password, 12);

    let user;
    try {
      user = await prisma.user.create({
        data: { email: data.email.toLowerCase(), username: data.username, passwordHash },
      });
    } catch (e) {
      if (e.code === 'P2002') {
        const field = e.meta?.target?.includes('email') ? 'email' : 'username';
        return res.status(409).json({ error: `${field} already taken` });
      }
      throw e;
    }

    const refreshRaw = crypto.randomBytes(40).toString('hex');
    const refreshHash = crypto.createHash('sha256').update(refreshRaw).digest('hex');
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    setRefreshCookie(res, refreshRaw);
    const accessToken = issueAccessToken(user);
    res.status(201).json({ accessToken, user: safeUser(user) });
  } catch (err) {
    next(err);
  }
});

// ─── LOGIN ────────────────────────────────────────────────────────────────────
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });

    if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const refreshRaw = crypto.randomBytes(40).toString('hex');
    const refreshHash = crypto.createHash('sha256').update(refreshRaw).digest('hex');
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    setRefreshCookie(res, refreshRaw);
    const accessToken = issueAccessToken(user);
    res.json({ accessToken, user: safeUser(user) });
  } catch (err) {
    next(err);
  }
});

// ─── REFRESH ──────────────────────────────────────────────────────────────────
router.post('/refresh', async (req, res, next) => {
  try {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (!raw) return res.status(401).json({ error: 'No refresh token' });

    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    const stored = await prisma.refreshToken.findUnique({ where: { token: hash } });

    if (!stored || stored.expiresAt < new Date()) {
      res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
      return res.status(401).json({ error: 'Refresh token invalid or expired' });
    }

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) return res.status(401).json({ error: 'User not found' });

    // Rotate refresh token
    const newRaw = crypto.randomBytes(40).toString('hex');
    const newHash = crypto.createHash('sha256').update(newRaw).digest('hex');
    await prisma.$transaction([
      prisma.refreshToken.delete({ where: { id: stored.id } }),
      prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: newHash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    setRefreshCookie(res, newRaw);
    res.json({ accessToken: issueAccessToken(user) });
  } catch (err) {
    next(err);
  }
});

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
router.post('/logout', async (req, res, next) => {
  try {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (raw) {
      const hash = crypto.createHash('sha256').update(raw).digest('hex');
      await prisma.refreshToken.deleteMany({ where: { token: hash } });
    }
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ─── ME ───────────────────────────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true, email: true, username: true, avatarLevel: true,
        totalPowerPoints: true, doppelgangerPowerPoints: true,
        monthlyPoints: true, currentStreak: true, tier: true,
        isPublic: true, isTopTenPercent: true, createdAt: true,
        teamMemberships: {
          select: { teamId: true, role: true, team: { select: { id: true, name: true, joinCode: true } } },
          take: 1,
        },
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Recalculate tier from points
    const tier = getTier(user.totalPowerPoints);
    if (tier.name !== user.tier) {
      await prisma.user.update({ where: { id: user.id }, data: { tier: tier.name } });
      user.tier = tier.name;
    }

    res.json({ user: { ...user, teamMemberships: undefined, team: user.teamMemberships[0] || null } });
  } catch (err) {
    next(err);
  }
});

function safeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

module.exports = router;
