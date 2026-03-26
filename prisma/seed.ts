import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const password = await bcrypt.hash('WoozNext14!!', 12);

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

  // Create agent account
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

  console.log('Seed completed!');
  console.log('Admin: admin@wooz.next / WoozNext14!!');
  console.log('Agent: agent@wooz.next / WoozNext14!!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
