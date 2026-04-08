'use strict';

const express = require('express');
const { prisma } = require('../services/db');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

// All admin routes require adminAuth
router.use(adminAuth);

// ─── STATS ────────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res, next) => {
  try {
    const today = getTodayKey();
    const [totalUsers, verifiedUsers, activeToday, totalTeams] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { emailVerified: true } }),
      prisma.dailyLog.count({ where: { dateKey: today } }),
      prisma.team.count(),
    ]);

    // Top 5 players by totalPowerPoints
    const topPlayers = await prisma.user.findMany({
      take: 5,
      orderBy: { totalPowerPoints: 'desc' },
      select: { id: true, username: true, tier: true, totalPowerPoints: true, currentStreak: true },
    });

    res.json({ totalUsers, verifiedUsers, activeToday, totalTeams, topPlayers });
  } catch (err) {
    next(err);
  }
});

// ─── USERS ────────────────────────────────────────────────────────────────────
router.get('/users', async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50')));
    const skip  = (page - 1) * limit;
    const search = req.query.search?.trim();

    const where = search
      ? { OR: [
          { username: { contains: search, mode: 'insensitive' } },
          { email:    { contains: search, mode: 'insensitive' } },
        ] }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, username: true,
          emailVerified: true, isAdmin: true,
          tier: true, totalPowerPoints: true, currentStreak: true,
          monthlyPoints: true, avatarLevel: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

// ─── FORCE VERIFY USER ────────────────────────────────────────────────────────
router.post('/users/:id/verify', async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.params.id },
      data: { emailVerified: true, emailVerifyToken: null, emailVerifyExpires: null },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ─── TOGGLE ADMIN ─────────────────────────────────────────────────────────────
router.post('/users/:id/toggle-admin', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: req.params.id },
      select: { isAdmin: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    await prisma.user.update({
      where: { id: req.params.id },
      data:  { isAdmin: !user.isAdmin },
    });
    res.json({ ok: true, isAdmin: !user.isAdmin });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE USER ──────────────────────────────────────────────────────────────
router.delete('/users/:id', async (req, res, next) => {
  try {
    // Prevent self-deletion
    if (req.params.id === req.user.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ─── DAILY LOGS (recent activity) ─────────────────────────────────────────────
router.get('/activity', async (req, res, next) => {
  try {
    const days = Math.min(30, parseInt(req.query.days || '7'));
    const logs = await prisma.dailyLog.findMany({
      where: { dateKey: { gte: daysAgoKey(days) } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        dateKey: true, completedHabits: true, pointsEarned: true,
        user: { select: { username: true, tier: true } },
      },
    });
    res.json({ logs });
  } catch (err) {
    next(err);
  }
});

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getTodayKey() {
  const now = new Date();
  if (now.getHours() < 4) now.setDate(now.getDate() - 1);
  return now.toISOString().slice(0, 10);
}

function daysAgoKey(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

module.exports = router;
