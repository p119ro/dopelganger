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
const { sendVerificationEmail, emailConfigured } = require('../services/email');

const router = express.Router();

const REFRESH_COOKIE = 'dg_refresh';

const registerSchema = z.object({
  email:    z.string().email(),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only'),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email:    z.string().email(),
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
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   7 * 24 * 60 * 60 * 1000,
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

    // Generate email verification token
    const verifyRaw    = crypto.randomBytes(32).toString('hex');
    const verifyToken  = crypto.createHash('sha256').update(verifyRaw).digest('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    let user;
    try {
      user = await prisma.user.create({
        data: {
          email:              data.email.toLowerCase(),
          username:           data.username,
          passwordHash,
          emailVerifyToken:   verifyToken,
          emailVerifyExpires: verifyExpires,
          emailVerified:      !emailConfigured(), // auto-verify when no email service
        },
      });
    } catch (e) {
      if (e.code === 'P2002') {
        const field = e.meta?.target?.includes('email') ? 'email' : 'username';
        return res.status(409).json({ error: `${field} already taken` });
      }
      throw e;
    }

    // Send verification email (non-blocking — don't fail register if email fails)
    if (emailConfigured()) {
      sendVerificationEmail(user.email, user.username, verifyRaw).catch(err => {
        console.error('[email] verification send failed:', err.message);
      });
    }

    const refreshRaw  = crypto.randomBytes(40).toString('hex');
    const refreshHash = crypto.createHash('sha256').update(refreshRaw).digest('hex');
    await prisma.refreshToken.create({
      data: {
        userId:    user.id,
        token:     refreshHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    setRefreshCookie(res, refreshRaw);
    const accessToken = issueAccessToken(user);
    res.status(201).json({
      accessToken,
      user: safeUser(user),
      emailVerificationSent: emailConfigured(),
    });
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

    if (!user.emailVerified) {
      return res.status(403).json({
        error: 'Please verify your email before logging in.',
        code:  'EMAIL_NOT_VERIFIED',
      });
    }

    const refreshRaw  = crypto.randomBytes(40).toString('hex');
    const refreshHash = crypto.createHash('sha256').update(refreshRaw).digest('hex');
    await prisma.refreshToken.create({
      data: {
        userId:    user.id,
        token:     refreshHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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
      // Validate dateKey format YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;
      const completed = Array.isArray(day.completed) ? day.completed : [];

      await prisma.dailyLog.upsert({
        where:  { userId_dateKey: { userId, dateKey } },
        create: {
          userId,
          dateKey,
          completedHabits:  completed,
          punishmentApplied: !!day.punishmentApplied,
          perfectDayBonus:  !!day.perfectDayBonus,
          pointsEarned:     day.pointsEarned || 0,
          penaltiesApplied: day.penaltiesApplied || 0,
        },
        update: {}, // Don't overwrite existing cloud data
      });
      imported++;
    }

    res.json({ ok: true, imported });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
