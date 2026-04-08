'use strict';

const { prisma } = require('./db');
const { calcMissedPoints } = require('./pointsService');

/**
 * Get the Monday and Sunday of a given date's week.
 */
function getWeekBounds(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMon);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    weekStartDate: toDateKey(monday),
    weekEndDate: toDateKey(sunday),
  };
}

function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Create weekly battles for all users that don't have one for the current week.
 */
async function createWeeklyBattles() {
  const { weekStartDate, weekEndDate } = getWeekBounds();
  const users = await prisma.user.findMany({ select: { id: true } });

  const created = [];
  for (const user of users) {
    const existing = await prisma.battle.findFirst({
      where: { userId: user.id, weekStartDate, isBossRaid: false },
    });
    if (!existing) {
      const battle = await prisma.battle.create({
        data: { userId: user.id, weekStartDate, weekEndDate, status: 'active' },
      });
      created.push(battle);
    }
  }
  console.log(`[battles] Created ${created.length} weekly battles for week ${weekStartDate}`);
  return created;
}

/**
 * Resolve yesterday's battle round for all users.
 * Called at 4AM daily (after punishment cron runs).
 */
async function resolveYesterdayRounds(io) {
  // Yesterday's dateKey (pre-4AM cutoff logic handled by cron timing)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateKey = toDateKey(yesterday);

  const { weekStartDate } = getWeekBounds(yesterday);

  const activeBattles = await prisma.battle.findMany({
    where: { weekStartDate, status: 'active', isBossRaid: false },
    include: { rounds: true },
  });

  for (const battle of activeBattles) {
    await resolveRound(battle, dateKey, yesterday, io);
  }

  // Boss raids that are active
  const activeBossRaids = await prisma.battle.findMany({
    where: { status: 'active', isBossRaid: true },
    include: { rounds: true },
  });

  for (const battle of activeBossRaids) {
    await resolveRound(battle, dateKey, yesterday, io);
  }
}

async function resolveRound(battle, dateKey, dateObj, io) {
  // Already resolved?
  const existing = battle.rounds.find(r => r.dateKey === dateKey);
  if (existing) return;

  // What day number is this in the battle?
  const startDate = new Date(battle.weekStartDate + 'T00:00:00Z');
  const diff = Math.floor((new Date(dateKey + 'T00:00:00Z') - startDate) / 86400000);
  const dayNumber = diff + 1;
  if (dayNumber < 1 || dayNumber > 7) return;

  // Get the user's daily log for yesterday
  const log = await prisma.dailyLog.findUnique({
    where: { userId_dateKey: { userId: battle.userId, dateKey } },
  });

  const userScore = log?.pointsEarned || 0;
  const doppelgangerScore = calcMissedPoints(log?.completedHabits || []);
  const winnerId = userScore >= doppelgangerScore ? 'user' : 'doppelganger';

  const round = await prisma.battleRound.create({
    data: {
      battleId: battle.id,
      dayNumber,
      dateKey,
      userScore,
      doppelgangerScore,
      winnerId,
      resolvedAt: new Date(),
    },
  });

  // Emit to the user's socket room
  if (io) {
    io.to(`user:${battle.userId}`).emit('battle:round_resolved', {
      battleId: battle.id,
      round: { dayNumber, dateKey, userScore, doppelgangerScore, winnerId },
    });
  }

  // If this is the last round (day 7), finalize
  const updatedBattle = await prisma.battle.findUnique({
    where: { id: battle.id },
    include: { rounds: true },
  });

  if (dayNumber === 7 || updatedBattle.rounds.length >= 7) {
    await finalizeBattle(updatedBattle, io);
  }
}

async function finalizeBattle(battle, io) {
  if (battle.status === 'completed') return;

  const userWins = battle.rounds.filter(r => r.winnerId === 'user').length;
  const dopWins = battle.rounds.filter(r => r.winnerId === 'doppelganger').length;
  const winnerId = userWins >= dopWins ? 'user' : 'doppelganger';

  const bonusPoints = battle.isBossRaid ? 200 : 50;

  await prisma.$transaction(async (tx) => {
    await tx.battle.update({
      where: { id: battle.id },
      data: { status: 'completed', winnerId, roundsData: battle.rounds },
    });

    if (winnerId === 'user') {
      await tx.user.update({
        where: { id: battle.userId },
        data: { totalPowerPoints: { increment: bonusPoints }, monthlyPoints: { increment: bonusPoints } },
      });
    } else {
      await tx.user.update({
        where: { id: battle.userId },
        data: { doppelgangerPowerPoints: { increment: bonusPoints } },
      });
    }
  });

  if (io) {
    io.to(`user:${battle.userId}`).emit('battle:weekly_result', {
      battleId: battle.id,
      winnerId,
      userWins,
      dopWins,
      rounds: battle.rounds,
      bonusPoints: winnerId === 'user' ? bonusPoints : 0,
    });
  }
}

module.exports = { createWeeklyBattles, resolveYesterdayRounds, getWeekBounds, toDateKey };
