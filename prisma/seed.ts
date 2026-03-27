import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const password = await bcrypt.hash('WoozNext14!!', 12);

  // Create default services
  const etatCivil = await prisma.service.upsert({
    where: { name: 'ETAT CIVIL' },
    update: {},
    create: { name: 'ETAT CIVIL', prefix: 'ECI' },
  });

  const centreSante = await prisma.service.upsert({
    where: { name: 'CENTRE DE SANTE' },
    update: {},
    create: { name: 'CENTRE DE SANTE', prefix: 'CMS' },
  });

  // Create admin account
  await prisma.agent.upsert({
    where: { email: 'admin@wooz.next' },
    update: { passwordHash: password },
    create: {
      name: 'Administrateur',
      email: 'admin@wooz.next',
      passwordHash: password,
      role: Role.ADMIN,
    },
  });

  // Create agent accounts
  await prisma.agent.upsert({
    where: { email: 'agent@wooz.next' },
    update: { passwordHash: password },
    create: {
      name: 'Agent',
      email: 'agent@wooz.next',
      passwordHash: password,
      role: Role.AGENT,
    },
  });

  await prisma.agent.upsert({
    where: { email: 'agent-educ@wooz.next' },
    update: { passwordHash: password },
    create: {
      name: 'Agent Etat Civil',
      email: 'agent-educ@wooz.next',
      passwordHash: password,
      role: Role.AGENT,
      serviceId: etatCivil.id,
    },
  });

  await prisma.agent.upsert({
    where: { email: 'agent-cms@wooz.next' },
    update: { passwordHash: password },
    create: {
      name: 'Agent Centre de Sante',
      email: 'agent-cms@wooz.next',
      passwordHash: password,
      role: Role.AGENT,
      serviceId: centreSante.id,
    },
  });

  console.log('Seed completed!');
  console.log('Services: ETAT CIVIL (ECI), CENTRE DE SANTE (CMS)');
  console.log('Admin:       admin@wooz.next / WoozNext14!!');
  console.log('Agent:       agent@wooz.next / WoozNext14!!');
  console.log('Agent ECI:   agent-educ@wooz.next / WoozNext14!!');
  console.log('Agent CMS:   agent-cms@wooz.next / WoozNext14!!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
