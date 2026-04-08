'use strict';

const jwt = require('jsonwebtoken');
const { prisma } = require('../services/db');

function initSockets(io) {
  // Auth middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));

      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.userId;
      socket.username = payload.username;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const { userId, username } = socket;
    console.log(`[socket] ${username} connected (${socket.id})`);

    // Join personal room for battle events
    socket.join(`user:${userId}`);

    // Join team room if in a team
    const membership = await prisma.teamMember.findFirst({
      where: { userId },
      select: { teamId: true },
    });
    if (membership) {
      socket.join(`team:${membership.teamId}`);
      socket.teamId = membership.teamId;

      // Notify team
      socket.to(`team:${membership.teamId}`).emit('team:member_online', { userId, username });
    }

    socket.on('disconnect', () => {
      console.log(`[socket] ${username} disconnected`);
      if (socket.teamId) {
        socket.to(`team:${socket.teamId}`).emit('team:member_offline', { userId, username });
      }
    });
  });
}

module.exports = { initSockets };
