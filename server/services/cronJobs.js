'use strict';

const cron = require('node-cron');
const { prisma } = require('./db');
const {
  calcMissedPoints,
  getTierMultiplier,
  getTeamGrade,
} = require('./pointsService');
const { resolveYesterdayRounds, createWeeklyBattles, toDateKey } = require('./battleEngine');

/**
 * 4:00 AM daily — apply end-of-day punishments + resolve battle rounds.
 */
function scheduleDailyCron(io) {
  cron.schedule('0 4 * * *', async () => {
    console.log('[cron] 4AM job starting');
    await runDailyJob(io);
  }, { timezone: 'UTC' });
}

async function runDailyJob(io) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateKey = toDateKey(yesterday);

  const users = await prisma.user.findMany({
    select: { id: true, tier: true, currentStreak: true },
  });

  for (const user of users) {
    await applyEndOfDayPunishment(user, dateKey, io);
  }

  await resolveYesterdayRounds(io);
  console.log('[cron] 4AM job complete for', dateKey);
}

async function applyEndOfDayPunishment(user, dateKey, io) {
  await prisma.$transaction(async (tx) => {
    let log = await tx.dailyLog.findUnique({
      where: { userId_dateKey: { userId: user.id, dateKey } },
    });

    if (!log) {
      log = await tx.dailyLog.create({
        data: { userId: user.id, dateKey, completedHabits: [], punishmentApplied: false },
      });
    }

    if (log.punishmentApplied) return;

    const missedBase = calcMissedPoints(log.completedHabits);
    const tierMult = getTierMultiplier(user.tier);
    const punishment = Math.floor(missedBase * tierMult);

    await tx.dailyLog.update({
      where: { id: log.id },
      data: { punishmentApplied: true },
    });

    await tx.user.update({
      where: { id: user.id },
      data: {
        totalPowerPoints: { decrement: punishment },
        doppelgangerPowerPoints: { increment: missedBase },
      },
    });
  });
}

/**
 * Monday 00:00 UTC — create weekly battles for all users.
 */
function scheduleWeeklyBattleCron() {
  cron.schedule('0 0 * * 1', async () => {
    console.log('[cron] Monday: creating weekly battles');
    await createWeeklyBattles();
  }, { timezone: 'UTC' });
}

/**
 * 1st of month 00:00 UTC — reset monthly leaderboard, archive top 10.
 */
function scheduleMonthlyReset() {
  cron.schedule('0 0 1 * *', async () => {
    console.log('[cron] Monthly reset starting');
    await runMonthlyReset();
  }, { timezone: 'UTC' });
}

async function runMonthlyReset() {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

  // Archive top 10
  const top10 = await prisma.user.findMany({
    where: { isPublic: true },
    orderBy: { monthlyPoints: 'desc' },
    take: 10,
    select: { id: true, monthlyPoints: true },
  });

  for (let i = 0; i < top10.length; i++) {
    await prisma.monthlyArchive.upsert({
      where: { userId_monthKey: { userId: top10[i].id, monthKey } },
      create: { userId: top10[i].id, monthKey, rank: i + 1, points: top10[i].monthlyPoints },
      update: { rank: i + 1, points: top10[i].monthlyPoints },
    });
  }

  // Reset monthly points
  await prisma.user.updateMany({ data: { monthlyPoints: 0 } });

  // Recalculate top-10% badges
  await recalcTopTenPercent();

  console.log('[cron] Monthly reset complete, archived', top10.length, 'users');
}

async function recalcTopTenPercent() {
  const total = await prisma.user.count({ where: { isPublic: true } });
  const threshold = Math.max(1, Math.ceil(total * 0.1));

  const topUsers = await prisma.user.findMany({
    where: { isPublic: true },
    orderBy: { monthlyPoints: 'desc' },
    take: threshold,
    select: { id: true },
  });

  const topIds = new Set(topUsers.map(u => u.id));

  await prisma.user.updateMany({ data: { isTopTenPercent: false } });
  if (topIds.size > 0) {
    await prisma.user.updateMany({
      where: { id: { in: [...topIds] } },
      data: { isTopTenPercent: true },
    });
  }
}

/**
 * Apply team multipliers to final daily scores — also part of 4AM job.
 * Runs after individual punishments so team scores are finalized.
 */
async function applyTeamMultipliers(dateKey) {
  const teams = await prisma.team.findMany({
    include: { members: { select: { userId: true } } },
  });

  for (const team of teams) {
    const memberIds = team.members.map(m => m.userId);
    const logs = await prisma.dailyLog.findMany({
      where: { userId: { in: memberIds }, dateKey, punishmentApplied: true },
    });

    const teamScore = logs.reduce((s, l) => s + l.pointsEarned, 0);
    const grade = getTeamGrade(teamScore);

    // Apply team multiplier adjustment to each member's final score for that day
    for (const log of logs) {
      const adjusted = log.pointsEarned * grade.multiplier;
      await prisma.dailyLog.update({
        where: { id: log.id },
        data: { pointsEarned: adjusted },
      });
      // Reflect delta in user's total
      const delta = adjusted - log.pointsEarned;
      if (delta !== 0) {
        await prisma.user.update({
          where: { id: log.userId },
          data: {
            totalPowerPoints: { increment: delta },
            monthlyPoints: { increment: delta },
          },
        });
      }
    }
  }
}

function startCronJobs(io) {
  scheduleDailyCron(io);
  scheduleWeeklyBattleCron();
  scheduleMonthlyReset();
  console.log('[cron] All cron jobs scheduled');
}

module.exports = {
  startCronJobs,
  runDailyJob,
  runMonthlyReset,
  applyEndOfDayPunishment,
  recalcTopTenPercent,
};
