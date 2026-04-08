'use strict';

const express = require('express');
const { z } = require('zod');
const { prisma } = require('../services/db');
const authMiddleware = require('../middleware/auth');
const { getTeamWithStats, generateJoinCode } = require('../services/teamService');
const { toDateKey } = require('../services/battleEngine');

const router = express.Router();
router.use(authMiddleware);

const createSchema = z.object({
  name: z.string().min(2).max(30),
  description: z.string().max(200).optional(),
});

const joinSchema = z.object({
  joinCode: z.string().length(6),
});

// ─── CREATE ───────────────────────────────────────────────────────────────────
router.post('/create', async (req, res, next) => {
  try {
    const { name, description } = createSchema.parse(req.body);
    const userId = req.user.userId;

    // Leave current team first (one team per user)
    const existing = await prisma.teamMember.findFirst({ where: { userId } });
    if (existing) return res.status(409).json({ error: 'You are already in a team. Leave first.' });

    const joinCode = await generateJoinCode();
    const team = await prisma.$transaction(async (tx) => {
      const t = await tx.team.create({
        data: { name, description, ownerId: userId, joinCode },
      });
      await tx.teamMember.create({ data: { teamId: t.id, userId, role: 'owner' } });
      return t;
    });

    const teamStats = await getTeamWithStats(team.id, toDateKey(new Date()));
    res.status(201).json({ team: teamStats });
  } catch (err) { next(err); }
});

// ─── JOIN ─────────────────────────────────────────────────────────────────────
router.post('/join', async (req, res, next) => {
  try {
    const { joinCode } = joinSchema.parse(req.body);
    const userId = req.user.userId;

    const team = await prisma.team.findUnique({
      where: { joinCode: joinCode.toUpperCase() },
      include: { members: true },
    });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.members.length >= 5) return res.status(409).json({ error: 'Team is full (max 5 members)' });

    const alreadyMember = team.members.some(m => m.userId === userId);
    if (alreadyMember) return res.status(409).json({ error: 'Already a member of this team' });

    const inAnotherTeam = await prisma.teamMember.findFirst({ where: { userId } });
    if (inAnotherTeam) return res.status(409).json({ error: 'You are already in a team. Leave first.' });

    await prisma.teamMember.create({ data: { teamId: team.id, userId, role: 'member' } });

    const io = req.app.get('io');
    if (io) {
      io.to(`team:${team.id}`).emit('team:member_joined', {
        userId, username: req.user.username,
      });
    }

    const teamStats = await getTeamWithStats(team.id, toDateKey(new Date()));
    res.json({ team: teamStats });
  } catch (err) { next(err); }
});

// ─── LEAVE ────────────────────────────────────────────────────────────────────
router.post('/leave', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const membership = await prisma.teamMember.findFirst({ where: { userId } });
    if (!membership) return res.status(404).json({ error: 'Not in a team' });

    await prisma.teamMember.delete({ where: { id: membership.id } });

    const io = req.app.get('io');
    if (io) {
      io.to(`team:${membership.teamId}`).emit('team:member_left', {
        userId, username: req.user.username,
      });
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── MY TEAM ──────────────────────────────────────────────────────────────────
router.get('/mine', async (req, res, next) => {
  try {
    const membership = await prisma.teamMember.findFirst({
      where: { userId: req.user.userId },
      select: { teamId: true },
    });
    if (!membership) return res.json({ team: null });

    const team = await getTeamWithStats(membership.teamId, toDateKey(new Date()));
    res.json({ team });
  } catch (err) { next(err); }
});

// ─── LEADERBOARD ─────────────────────────────────────────────────────────────
router.get('/leaderboard', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const today = toDateKey(new Date());

    // Get weekly points per team (sum of members' points this week)
    const teams = await prisma.team.findMany({
      include: {
        members: {
          select: { userId: true, user: { select: { monthlyPoints: true } } },
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
      .slice(0, 20)
      .map((t, i) => ({ ...t, rank: i + 1 }));

    // Find user's team rank
    const userMembership = await prisma.teamMember.findFirst({ where: { userId } });
    let userTeamRank = null;
    if (userMembership && !ranked.find(t => t.id === userMembership.teamId)) {
      const all = teams
        .map(t => ({ id: t.id, weeklyPoints: t.members.reduce((s, m) => s + m.user.monthlyPoints, 0) }))
        .sort((a, b) => b.weeklyPoints - a.weeklyPoints);
      const idx = all.findIndex(t => t.id === userMembership.teamId);
      if (idx !== -1) {
        userTeamRank = { teamId: userMembership.teamId, rank: idx + 1 };
      }
    }

    res.json({ teams: ranked, userTeamRank });
  } catch (err) { next(err); }
});

// ─── MEMBERS ──────────────────────────────────────────────────────────────────
router.get('/:teamId/members', async (req, res, next) => {
  try {
    const team = await getTeamWithStats(req.params.teamId, toDateKey(new Date()));
    if (!team) return res.status(404).json({ error: 'Team not found' });
    res.json({ members: team.members });
  } catch (err) { next(err); }
});

module.exports = router;
