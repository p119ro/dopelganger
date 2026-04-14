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
const REFRESH_DAYS   = 30; // keep users logged in for 30 days

const registerSchema = z.object({
  email:    z.string().email(),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only'),
  password: z.string().min(8).max(128),
});

// identifier = email OR username
const loginSchema = z.object({
  identifier: z.string().min(1),
  password:   z.string().min(1),
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
    secure:   process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge:   REFRESH_DAYS * 24 * 60 * 60 * 1000,
    path:     '/api/auth',
  });
}

function safeUser(user) {
  const { passwordHash, emailVerifyToken, emailVerifyExpires, ...safe } = user;
  return safe;
}

// ─── REGISTER ────────────────────────────────────────────────────────────────
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(data.password, 12);

    let user;
    try {
      user = await prisma.user.create({
        data: {
          email:         data.email.toLowerCase(),
          username:      data.username,
          passwordHash,
          emailVerified: true, // auto-verify — no email gate
        },
      });
    } catch (e) {
      if (e.code === 'P2002') {
        const field = e.meta?.target?.includes('email') ? 'email' : 'username';
        return res.status(409).json({ error: `${field} already taken` });
      }
      throw e;
    }

    const refreshRaw  = crypto.randomBytes(40).toString('hex');
    const refreshHash = crypto.createHash('sha256').update(refreshRaw).digest('hex');
    await prisma.refreshToken.create({
      data: {
        userId:    user.id,
        token:     refreshHash,
        expiresAt: new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    setRefreshCookie(res, refreshRaw);
    const accessToken = issueAccessToken(user);
    res.status(201).json({
      accessToken,
      user: safeUser(user),
      emailVerificationSent: false,
    });
  } catch (err) {
    next(err);
  }
});

// ─── LOGIN ────────────────────────────────────────────────────────────────────
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const id   = data.identifier.trim();

    // Lookup by email if contains @, otherwise by username (case-insensitive)
    const user = id.includes('@')
      ? await prisma.user.findUnique({ where: { email: id.toLowerCase() } })
      : await prisma.user.findFirst({ where: { username: { equals: id, mode: 'insensitive' } } });

    if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const refreshRaw  = crypto.randomBytes(40).toString('hex');
    const refreshHash = crypto.createHash('sha256').update(refreshRaw).digest('hex');
    await prisma.refreshToken.create({
      data: {
        userId:    user.id,
        token:     refreshHash,
        expiresAt: new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    setRefreshCookie(res, refreshRaw);
    res.json({ accessToken: issueAccessToken(user), user: safeUser(user) });
  } catch (err) {
    next(err);
  }
});

// ─── VERIFY EMAIL ─────────────────────────────────────────────────────────────
router.get('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token required' });

    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await prisma.user.findFirst({
      where: { emailVerifyToken: hash, emailVerified: false },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or already used verification link.' });
    }
    if (user.emailVerifyExpires && user.emailVerifyExpires < new Date()) {
      return res.status(400).json({ error: 'Verification link has expired. Please request a new one.' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerifyToken: null, emailVerifyExpires: null },
    });

    // Redirect to frontend with success flag
    const appUrl = process.env.APP_URL || '';
    res.redirect(`${appUrl}/?verified=1`);
  } catch (err) {
    next(err);
  }
});

// ─── RESEND VERIFICATION ──────────────────────────────────────────────────────
router.post('/resend-verification', authLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || user.emailVerified) {
      // Don't reveal whether the email exists
      return res.json({ ok: true });
    }

    const verifyRaw     = crypto.randomBytes(32).toString('hex');
    const verifyToken   = crypto.createHash('sha256').update(verifyRaw).digest('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyToken: verifyToken, emailVerifyExpires: verifyExpires },
    });

    if (emailConfigured()) {
      await sendVerificationEmail(user.email, user.username, verifyRaw);
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ─── REFRESH ──────────────────────────────────────────────────────────────────
router.post('/refresh', async (req, res, next) => {
  try {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (!raw) return res.status(401).json({ error: 'No refresh token' });

    const hash   = crypto.createHash('sha256').update(raw).digest('hex');
    const stored = await prisma.refreshToken.findUnique({ where: { token: hash } });

    if (!stored || stored.expiresAt < new Date()) {
      res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
      return res.status(401).json({ error: 'Refresh token invalid or expired' });
    }

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) return res.status(401).json({ error: 'User not found' });

    // Rotate refresh token
    const newRaw  = crypto.randomBytes(40).toString('hex');
    const newHash = crypto.createHash('sha256').update(newRaw).digest('hex');
    await prisma.$transaction([
      prisma.refreshToken.delete({ where: { id: stored.id } }),
      prisma.refreshToken.create({
        data: {
          userId:    user.id,
          token:     newHash,
          expiresAt: new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000),
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
        isPublic: true, isTopTenPercent: true, isAdmin: true,
        emailVerified: true, createdAt: true,
        teamMemberships: {
          select: { teamId: true, role: true, team: { select: { id: true, name: true, joinCode: true } } },
          take: 1,
        },
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

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

// ─── IMPORT LEGACY LOCALSTORAGE ───────────────────────────────────────────────
// Called once after login/register if the user has old localStorage data
router.post('/import-legacy', authLimiter, authMiddleware, async (req, res, next) => {
  try {
    const { dailyData } = req.body;
    if (!dailyData || typeof dailyData !== 'object') {
      return res.status(400).json({ error: 'dailyData object required' });
    }

    const userId = req.user.userId;
    let imported = 0;

    for (const [dateKey, day] of Object.entries(dailyData)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;
      const completed = Array.isArray(day.completed) ? day.completed : [];

      await prisma.dailyLog.upsert({
        where:  { userId_dateKey: { userId, dateKey } },
        create: {
          userId,
          dateKey,
          completedHabits:   completed,
          punishmentApplied: !!day.punishmentApplied,
          perfectDayBonus:   !!day.perfectDayBonus,
          pointsEarned:      day.pointsEarned || 0,
          penaltiesApplied:  day.penaltiesApplied || 0,
        },
        update: {}, // Don't overwrite existing cloud data
      });
      imported++;
    }

    // Recalculate user stats from all logs
    const allLogs = await prisma.dailyLog.findMany({
      where:  { userId },
      select: { dateKey: true, pointsEarned: true, completedHabits: true },
    });

    const totalPowerPoints = allLogs.reduce((s, l) => s + l.pointsEarned, 0);

    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthlyPoints = allLogs
      .filter(l => l.dateKey.startsWith(thisMonth))
      .reduce((s, l) => s + l.pointsEarned, 0);

    // Consecutive streak ending today (or yesterday if today has no log yet)
    const activeDates = new Set(
      allLogs.filter(l => l.completedHabits.length > 0).map(l => l.dateKey)
    );
    let currentStreak = 0;
    const cursor = new Date();
    // If today has no entry yet, start from yesterday
    if (!activeDates.has(cursor.toISOString().slice(0, 10))) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (activeDates.has(cursor.toISOString().slice(0, 10))) {
      currentStreak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    const tier = getTier(totalPowerPoints).name;

    await prisma.user.update({
      where: { id: userId },
      data:  { totalPowerPoints, monthlyPoints, currentStreak, tier },
    });

    res.json({ ok: true, imported, stats: { totalPowerPoints, monthlyPoints, currentStreak, tier } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
