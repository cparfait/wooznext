import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

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
    where: { email: 'admin' },
    update: { passwordHash: adminPwd },
    create: {
      name: 'Administrateur',
      email: 'admin',
      passwordHash: adminPwd,
      role: Role.ADMIN,
    },
  });

  // Create agent accounts
  await prisma.agent.upsert({
    where: { email: 'agent1' },
    update: { passwordHash: agentPwd, serviceId: support.id },
    create: {
      name: 'Agent 1',
      email: 'agent1',
      passwordHash: agentPwd,
      role: Role.AGENT,
      serviceId: support.id,
    },
  });

  await prisma.agent.upsert({
    where: { email: 'agent2' },
    update: { passwordHash: agentPwd, serviceId: accueil.id },
    create: {
      name: 'Agent 2',
      email: 'agent2',
      passwordHash: agentPwd,
      role: Role.AGENT,
      serviceId: accueil.id,
    },
  });

  console.log('Seed completed!');
  console.log('Services: SUPPORT (SUP), ACCUEIL (ACC)');
  console.log('Admin:    admin / admin');
  console.log('Agent 1:  agent1 / agent  (SUPPORT)');
  console.log('Agent 2:  agent2 / agent  (ACCUEIL)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
