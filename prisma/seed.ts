import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default services
  const etatCivil = await prisma.service.upsert({
    where: { name: 'État civil' },
    update: {},
    create: { name: 'État civil', prefix: 'EC' },
  });

  const urbanisme = await prisma.service.upsert({
    where: { name: 'Urbanisme' },
    update: {},
    create: { name: 'Urbanisme', prefix: 'UR' },
  });

  const accueilGeneral = await prisma.service.upsert({
    where: { name: 'Accueil général' },
    update: {},
    create: { name: 'Accueil général', prefix: '' },
  });

  // Create admin account
  const adminPassword = await bcrypt.hash('admin123', 12);
  await prisma.agent.upsert({
    where: { email: 'admin@mairie.fr' },
    update: {},
    create: {
      name: 'Administrateur',
      email: 'admin@mairie.fr',
      passwordHash: adminPassword,
      role: Role.ADMIN,
      serviceId: accueilGeneral.id,
    },
  });

  // Create a test agent
  const agentPassword = await bcrypt.hash('agent123', 12);
  await prisma.agent.upsert({
    where: { email: 'agent@mairie.fr' },
    update: {},
    create: {
      name: 'Agent Test',
      email: 'agent@mairie.fr',
      passwordHash: agentPassword,
      role: Role.AGENT,
      serviceId: etatCivil.id,
    },
  });

  // Create counters
  await prisma.counter.createMany({
    data: [
      { label: 'Guichet 1', serviceId: etatCivil.id },
      { label: 'Guichet 2', serviceId: etatCivil.id },
      { label: 'Guichet 1', serviceId: urbanisme.id },
      { label: 'Accueil', serviceId: accueilGeneral.id },
    ],
    skipDuplicates: true,
  });

  console.log('Seed completed!');
  console.log('Admin: admin@mairie.fr / admin123');
  console.log('Agent: agent@mairie.fr / agent123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
