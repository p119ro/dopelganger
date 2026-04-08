'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('[seed] Seeding demo data...');

  const hash = await bcrypt.hash('password123', 12);

  // Create demo users
  const users = [];
  for (let i = 1; i <= 3; i++) {
    const user = await prisma.user.upsert({
      where: { email: `demo${i}@doppelganger.app` },
      create: {
        email: `demo${i}@doppelganger.app`,
        username: `DemoUser${i}`,
        passwordHash: hash,
        totalPowerPoints: i * 300,
        monthlyPoints: i * 100,
        currentStreak: i * 2,
        tier: i === 1 ? 'bronze' : i === 2 ? 'silver' : 'gold',
      },
      update: {},
    });
    users.push(user);
    console.log(`[seed] User: ${user.username} (${user.email})`);
  }

  // Create a demo team
  const existing = await prisma.team.findUnique({ where: { joinCode: 'DEMO01' } });
  if (!existing) {
    const team = await prisma.team.create({
      data: {
        name: 'Demo Squad',
        joinCode: 'DEMO01',
        description: 'A demo team for testing',
        ownerId: users[0].id,
        members: {
          create: [
            { userId: users[0].id, role: 'owner' },
            { userId: users[1].id, role: 'member' },
          ],
        },
      },
    });
    console.log(`[seed] Team: ${team.name} (code: ${team.joinCode})`);
  }

  console.log('[seed] Done! Login with demo1@doppelganger.app / password123');
}

main().catch(console.error).finally(() => prisma.$disconnect());
