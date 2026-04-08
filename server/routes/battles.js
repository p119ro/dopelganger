'use strict';

const express = require('express');
const { z } = require('zod');
const { prisma } = require('../services/db');
const authMiddleware = require('../middleware/auth');
const { getWeekBounds, toDateKey } = require('../services/battleEngine');
const { calcMissedPoints } = require('../services/pointsService');

const router = express.Router();
router.use(authMiddleware);

// ─── CURRENT BATTLE ──────────────────────────────────────────────────────────
router.get('/current', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { weekStartDate } = getWeekBounds();

    let battle = await prisma.battle.findFirst({
      where: { userId, weekStartDate, isBossRaid: false },
      include: { rounds: { orderBy: { dayNumber: 'asc' } } },
    });

    if (!battle) {
      // Create on demand for current user
      const { weekEndDate } = getWeekBounds();
      battle = await prisma.battle.create({
        data: { userId, weekStartDate, weekEndDate, status: 'active' },
        include: { rounds: { orderBy: { dayNumber: 'asc' } } },
      });
    }

    // Projected today's score
    const todayKey = toDateKey(new Date());
    const todayLog = await prisma.dailyLog.findUnique({
      where: { userId_dateKey: { userId, dateKey: todayKey } },
    });

    const projectedUserScore = todayLog?.pointsEarned || 0;
    const projectedDopScore = calcMissedPoints(todayLog?.completedHabits || []);

    res.json({
      battle,
      projected: { userScore: projectedUserScore, doppelgangerScore: projectedDopScore },
    });
  } catch (err) { next(err); }
});

// ─── BATTLE HISTORY ───────────────────────────────────────────────────────────
router.get('/history', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const battles = await prisma.battle.findMany({
      where: { userId: req.user.userId, status: 'completed' },
      include: { rounds: { orderBy: { dayNumber: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    res.json({ battles });
  } catch (err) { next(err); }
});

// ─── BATTLE STATS ─────────────────────────────────────────────────────────────
router.get('/stats', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const battles = await prisma.battle.findMany({
      where: { userId, status: 'completed' },
      select: { winnerId: true, rounds: { select: { winnerId: true, userScore: true } } },
    });

    const wins = battles.filter(b => b.winnerId === 'user').length;
    const losses = battles.filter(b => b.winnerId === 'doppelganger').length;

    let winStreak = 0, maxWinStreak = 0, curStreak = 0;
    for (const b of battles) {
      if (b.winnerId === 'user') {
        curStreak++;
        maxWinStreak = Math.max(maxWinStreak, curStreak);
      } else {
        curStreak = 0;
      }
    }
    winStreak = curStreak;

    const bestWeekScore = battles.reduce((best, b) => {
      const total = b.rounds.reduce((s, r) => s + r.userScore, 0);
      return Math.max(best, total);
    }, 0);

    res.json({ wins, losses, winStreak, bestWeekScore });
  } catch (err) { next(err); }
});

// ─── BOSS RAID (opt-in) ───────────────────────────────────────────────────────
router.post('/boss-raid/start', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const now = new Date();

    // Only available on 1st of month
    if (now.getDate() !== 1) {
      return res.status(400).json({ error: 'Boss Raids are only available on the 1st of the month' });
    }

    const monthStart = toDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
    const existing = await prisma.battle.findFirst({
      where: { userId, isBossRaid: true, weekStartDate: monthStart },
    });
    if (existing) return res.status(409).json({ error: 'Boss Raid already started this month' });

    // Boss power = sum of all missed habit points this month
    const monthLogs = await prisma.dailyLog.findMany({
      where: { userId, dateKey: { gte: monthStart } },
    });
    const bossPower = monthLogs.reduce((s, l) => {
      return s + calcMissedPoints(l.completedHabits);
    }, 0);

    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 6);

    const battle = await prisma.battle.create({
      data: {
        userId,
        weekStartDate: toDateKey(now),
        weekEndDate: toDateKey(endDate),
        isBossRaid: true,
        bosspower: bossPower,
        status: 'active',
      },
      include: { rounds: true },
    });

    res.status(201).json({ battle });
  } catch (err) { next(err); }
});

module.exports = router;
