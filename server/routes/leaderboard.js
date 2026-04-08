'use strict';

const express = require('express');
const { prisma } = require('../services/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ─── GLOBAL LEADERBOARD ───────────────────────────────────────────────────────
router.get('/global', async (req, res, next) => {
  try {
    const period = req.query.period || 'monthly';
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    const orderField = period === 'alltime' ? 'totalPowerPoints' : 'monthlyPoints';

    const users = await prisma.user.findMany({
      where: { isPublic: true },
      orderBy: { [orderField]: 'desc' },
      take: limit,
      select: {
        id: true,
        username: true,
        tier: true,
        monthlyPoints: true,
        totalPowerPoints: true,
        currentStreak: true,
        isTopTenPercent: true,
      },
    });

    const leaderboard = users.map((u, i) => ({
      rank: i + 1,
      id: u.id,
      username: u.username.slice(0, 12),
      tier: u.tier,
      points: period === 'alltime' ? u.totalPowerPoints : u.monthlyPoints,
      streak: u.currentStreak,
      isTopTenPercent: u.isTopTenPercent,
    }));

    res.json({ leaderboard, period });
  } catch (err) { next(err); }
});

// ─── USER RANK ────────────────────────────────────────────────────────────────
router.get('/rank', async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { monthlyPoints: true, isPublic: true },
    });

    if (!user || !user.isPublic) {
      return res.json({ rank: null, message: 'Not participating in leaderboard' });
    }

    const rank = await prisma.user.count({
      where: { isPublic: true, monthlyPoints: { gt: user.monthlyPoints } },
    });

    res.json({ rank: rank + 1, monthlyPoints: user.monthlyPoints });
  } catch (err) { next(err); }
});

// ─── TEAM LEADERBOARD ─────────────────────────────────────────────────────────
router.get('/teams', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    const teams = await prisma.team.findMany({
      include: {
        members: {
          select: { user: { select: { monthlyPoints: true } } },
        },
      },
    });

    const ranked = teams
      .map(t => ({
        id: t.id,
        name: t.name,
        memberCount: t.members.length,
        weeklyPoints: t.members.reduce((s, m) => s + m.user.monthlyPoints, 0),
      }))
      .sort((a, b) => b.weeklyPoints - a.weeklyPoints)
      .slice(0, limit)
      .map((t, i) => ({ ...t, rank: i + 1 }));

    res.json({ teams: ranked });
  } catch (err) { next(err); }
});

module.exports = router;
