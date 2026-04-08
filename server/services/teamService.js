'use strict';

const { prisma } = require('./db');
const { getTeamGrade } = require('./pointsService');

/**
 * Get a team with members and their today's scores.
 */
async function getTeamWithStats(teamId, todayKey) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              tier: true,
              totalPowerPoints: true,
              currentStreak: true,
            },
          },
        },
      },
    },
  });

  if (!team) return null;

  // Fetch each member's daily log for today
  const memberIds = team.members.map(m => m.user.id);
  const todayLogs = await prisma.dailyLog.findMany({
    where: { userId: { in: memberIds }, dateKey: todayKey },
  });

  const logMap = Object.fromEntries(todayLogs.map(l => [l.userId, l]));

  const members = team.members.map(m => {
    const log = logMap[m.user.id];
    return {
      ...m.user,
      role: m.role,
      joinedAt: m.joinedAt,
      todayPoints: log?.pointsEarned || 0,
      todayCompleted: log?.completedHabits || [],
    };
  });

  const teamScore = members.reduce((sum, m) => sum + m.todayPoints, 0);
  const grade = getTeamGrade(teamScore);

  return {
    id: team.id,
    name: team.name,
    joinCode: team.joinCode,
    description: team.description,
    ownerId: team.ownerId,
    members,
    teamScore,
    grade: grade.label,
    gradeEmoji: grade.emoji,
    multiplier: grade.multiplier,
  };
}

/**
 * Generate a unique 6-char alphanumeric join code.
 */
async function generateJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  let exists = true;
  while (exists) {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    exists = await prisma.team.findUnique({ where: { joinCode: code } });
  }
  return code;
}

module.exports = { getTeamWithStats, generateJoinCode };
