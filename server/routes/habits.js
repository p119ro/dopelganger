'use strict';

const express = require('express');
const { z } = require('zod');
const { prisma } = require('../services/db');
const authMiddleware = require('../middleware/auth');
const {
  HABITS,
  calcBasePoints,
  calcMissedPoints,
  getStreakMultiplier,
  getTier,
  PERFECT_DAY_BONUS,
  TOTAL_HABITS,
} = require('../services/pointsService');
const { getTeamWithStats } = require('../services/teamService');
const { toDateKey } = require('../services/battleEngine');

const router = express.Router();
router.use(authMiddleware);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validDateKey(dateKey) {
  if (!DATE_RE.test(dateKey)) return false;
  const today = toDateKey(new Date());
  return dateKey <= today;
}

// ─── GET daily log for a date ─────────────────────────────────────────────────
router.get('/log/:dateKey', async (req, res, next) => {
  try {
    const { dateKey } = req.params;
    if (!validDateKey(dateKey)) return res.status(400).json({ error: 'Invalid dateKey' });

    const log = await prisma.dailyLog.findUnique({
      where: { userId_dateKey: { userId: req.user.userId, dateKey } },
    });

    res.json({ log: log || { userId: req.user.userId, dateKey, completedHabits: [], pointsEarned: 0, penaltiesApplied: 0 } });
  } catch (err) { next(err); }
});

// ─── TOGGLE habit ─────────────────────────────────────────────────────────────
const toggleSchema = z.object({
  habitId: z.string().refine(id => id in HABITS, 'Unknown habit'),
  completed: z.boolean(),
  dateKey: z.string().regex(DATE_RE),
});

router.post('/toggle', async (req, res, next) => {
  try {
    const { habitId, completed, dateKey } = toggleSchema.parse(req.body);
    if (!validDateKey(dateKey)) return res.status(400).json({ error: 'Invalid or future dateKey' });

    const userId = req.user.userId;

    const result = await prisma.$transaction(async (tx) => {
      // Upsert log
      let log = await tx.dailyLog.upsert({
        where: { userId_dateKey: { userId, dateKey } },
        create: { userId, dateKey, completedHabits: [], penaltiesApplied: 0, pointsEarned: 0 },
        update: {},
      });

      // Update completedHabits
      let completed_habits = [...log.completedHabits];
      if (completed && !completed_habits.includes(habitId)) {
        completed_habits.push(habitId);
      } else if (!completed) {
        completed_habits = completed_habits.filter(h => h !== habitId);
      }

      // Recalculate streak for this habit
      const streakRecord = await tx.habitStreak.findUnique({
        where: { userId_habitId: { userId, habitId } },
      });

      let currentStreak = streakRecord?.currentStreak || 0;
      let longestStreak = streakRecord?.longestStreak || 0;

      if (completed) {
        // Check if yesterday was also completed
        const yesterday = new Date(dateKey + 'T00:00:00Z');
        yesterday.setDate(yesterday.getDate() - 1);
        const yKey = toDateKey(yesterday);
        const yesterdayLog = await tx.dailyLog.findUnique({
          where: { userId_dateKey: { userId, dateKey: yKey } },
        });
        const wasYesterdayCompleted = yesterdayLog?.completedHabits?.includes(habitId);
        currentStreak = wasYesterdayCompleted ? (streakRecord?.currentStreak || 0) + 1 : 1;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }

      await tx.habitStreak.upsert({
        where: { userId_habitId: { userId, habitId } },
        create: { userId, habitId, currentStreak, longestStreak, lastCompletedDate: completed ? dateKey : null },
        update: { currentStreak, longestStreak, lastCompletedDate: completed ? dateKey : null },
      });

      // Get overall user streak for multiplier
      const user = await tx.user.findUnique({ where: { id: userId }, select: { currentStreak: true, tier: true, totalPowerPoints: true, monthlyPoints: true } });
      const streakMult = getStreakMultiplier(user.currentStreak);

      // Recalculate points
      const base = calcBasePoints(completed_habits, log.penaltiesApplied);
      const boosted = base * streakMult;

      // Perfect day bonus
      let perfectDayBonus = log.perfectDayBonus;
      let perfectBonusDelta = 0;
      if (completed_habits.length === TOTAL_HABITS && !perfectDayBonus) {
        perfectDayBonus = true;
        perfectBonusDelta = PERFECT_DAY_BONUS;
      } else if (completed_habits.length < TOTAL_HABITS && perfectDayBonus) {
        perfectDayBonus = false;
        perfectBonusDelta = -PERFECT_DAY_BONUS;
      }

      const newPoints = boosted + (perfectDayBonus ? PERFECT_DAY_BONUS : 0);
      const pointsDelta = newPoints - log.pointsEarned;

      const updatedLog = await tx.dailyLog.update({
        where: { id: log.id },
        data: {
          completedHabits: completed_habits,
          pointsEarned: newPoints,
          perfectDayBonus,
        },
      });

      // Update user totals
      const newTotalPoints = user.totalPowerPoints + pointsDelta;
      const tierInfo = getTier(newTotalPoints);

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          totalPowerPoints: { increment: pointsDelta },
          monthlyPoints: { increment: pointsDelta },
          tier: tierInfo.name,
        },
        select: { id: true, totalPowerPoints: true, monthlyPoints: true, tier: true, currentStreak: true, doppelgangerPowerPoints: true },
      });

      return { log: updatedLog, user: updatedUser };
    });

    // Emit team update if user is in a team
    const io = req.app.get('io');
    const todayKey = toDateKey(new Date());
    const membership = await prisma.teamMember.findFirst({
      where: { userId: req.user.userId },
      select: { teamId: true },
    });

    if (membership && io) {
      const teamStats = await getTeamWithStats(membership.teamId, todayKey);
      io.to(`team:${membership.teamId}`).emit('team:habit_update', {
        userId: req.user.userId,
        username: req.user.username,
        habitId,
        completed,
        newTeamScore: teamStats?.teamScore || 0,
        newGrade: teamStats?.grade || 'Poor',
      });

      // Emit live battle update for today
      io.to(`user:${req.user.userId}`).emit('battle:live_update', {
        todayScore: result.log.pointsEarned,
        completedToday: result.log.completedHabits.length,
      });
    }

    res.json({ log: result.log, user: result.user });
  } catch (err) { next(err); }
});

// ─── PENALTY ──────────────────────────────────────────────────────────────────
const penaltySchema = z.object({ dateKey: z.string().regex(DATE_RE) });

router.post('/penalty', async (req, res, next) => {
  try {
    const { dateKey } = penaltySchema.parse(req.body);
    if (!validDateKey(dateKey)) return res.status(400).json({ error: 'Invalid dateKey' });

    const userId = req.user.userId;

    const result = await prisma.$transaction(async (tx) => {
      const log = await tx.dailyLog.upsert({
        where: { userId_dateKey: { userId, dateKey } },
        create: { userId, dateKey, completedHabits: [], penaltiesApplied: 1, pointsEarned: 0 },
        update: { penaltiesApplied: { increment: 1 }, pointsEarned: { decrement: 10 } },
      });

      const user = await tx.user.update({
        where: { id: userId },
        data: { totalPowerPoints: { decrement: 10 }, monthlyPoints: { decrement: 10 } },
        select: { totalPowerPoints: true, monthlyPoints: true, tier: true },
      });

      return { log, user };
    });

    res.json(result);
  } catch (err) { next(err); }
});

// ─── STREAKS ──────────────────────────────────────────────────────────────────
router.get('/streaks', async (req, res, next) => {
  try {
    const streaks = await prisma.habitStreak.findMany({
      where: { userId: req.user.userId },
    });
    res.json({ streaks });
  } catch (err) { next(err); }
});

// ─── HISTORY ──────────────────────────────────────────────────────────────────
router.get('/history', async (req, res, next) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 365);
    const logs = await prisma.dailyLog.findMany({
      where: { userId: req.user.userId },
      orderBy: { dateKey: 'desc' },
      take: days,
    });
    res.json({ logs });
  } catch (err) { next(err); }
});

module.exports = router;
