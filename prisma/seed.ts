import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const adminPwd = await bcrypt.hash('admin', 12);
  const agentPwd = await bcrypt.hash('agent', 12);

  // Create default services
  const support = await prisma.service.upsert({
    where: { name: 'SUPPORT' },
    update: {},
    create: { name: 'SUPPORT', prefix: 'SUP' },
  });

  const accueil = await prisma.service.upsert({
    where: { name: 'ACCUEIL' },
    update: {},
    create: { name: 'ACCUEIL', prefix: 'ACC' },
  });

  // Create admin account
  await prisma.agent.upsert({
    where: { email: 'admin@wooz.next' },
    update: { passwordHash: adminPwd },
    create: {
      firstName: 'Admin',
      lastName: 'Wooznext',
      email: 'admin@wooz.next',
      passwordHash: adminPwd,
      role: Role.ADMIN,
    },
  });

  // Create agent accounts
  await prisma.agent.upsert({
    where: { email: 'agent1@wooz.next' },
    update: { passwordHash: agentPwd, serviceId: support.id },
    create: {
      firstName: 'Jean',
      lastName: 'Dupont',
      email: 'agent1@wooz.next',
      passwordHash: agentPwd,
      role: Role.AGENT,
      serviceId: support.id,
    },
  });

  await prisma.agent.upsert({
    where: { email: 'agent2@wooz.next' },
    update: { passwordHash: agentPwd, serviceId: accueil.id },
    create: {
      firstName: 'Marie',
      lastName: 'Martin',
      email: 'agent2@wooz.next',
      passwordHash: agentPwd,
      role: Role.AGENT,
      serviceId: accueil.id,
    },
  });

  const anonPwd = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
  await prisma.agent.upsert({
    where: { email: 'anonymized-SUP@wooz.internal' },
    update: {},
    create: {
      firstName: 'Anciens',
      lastName: 'Agents SUP',
      email: 'anonymized-SUP@wooz.internal',
      passwordHash: anonPwd,
      role: Role.AGENT,
      serviceId: support.id,
      isActive: false,
      isAnonymized: true,
    },
  });

  await prisma.agent.upsert({
    where: { email: 'anonymized-ACC@wooz.internal' },
    update: {},
    create: {
      firstName: 'Anciens',
      lastName: 'Agents ACC',
      email: 'anonymized-ACC@wooz.internal',
      passwordHash: anonPwd,
      role: Role.AGENT,
      serviceId: accueil.id,
      isActive: false,
      isAnonymized: true,
    },
  });

  // Create default opening hours for each service
  const defaultHours = Array.from({ length: 7 }, (_, i) => ({
    openTime: '08:30',
    closeTime: '17:00',
    isClosed: i >= 5,
  }));

  for (const service of [support, accueil]) {
    const existing = await prisma.openingHours.findMany({ where: { serviceId: service.id } });
    if (existing.length === 0) {
      await prisma.$transaction(
        defaultHours.map((h, i) =>
          prisma.openingHours.create({
            data: {
              serviceId: service.id,
              dayOfWeek: i,
              openTime: h.openTime,
              closeTime: h.closeTime,
              isClosed: h.isClosed,
            },
          })
        )
      );
    }
  }

  console.log('Seed completed!');
  console.log('Services: SUPPORT (SUP), ACCUEIL (ACC)');
  console.log('Admin:    admin@wooz.next / admin');
  console.log('Agent 1:  agent1@wooz.next / agent  (SUPPORT)');
  console.log('Agent 2:  agent2@wooz.next / agent  (ACCUEIL)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
