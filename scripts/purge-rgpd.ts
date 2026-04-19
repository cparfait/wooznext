/**
 * RGPD Purge Script
 *
 * Anonymizes visitor phone numbers older than 30 days while preserving
 * all tickets for historical statistics. Each visitor gets a unique
 * `anon:{id}` marker so the unique constraint on phone is respected and
 * stats can still distinguish individual visitors.
 *
 * Run with: npx tsx scripts/purge-rgpd.ts
 * Schedule as a daily cron job in production.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const RETENTION_DAYS = 30;

async function main() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  console.log(`Anonymizing visitors older than ${cutoff.toISOString()} (${RETENTION_DAYS} days)...`);

  const anonymizedCount: number = await prisma.$executeRaw`
    UPDATE visitors
    SET phone = 'anon:' || id
    WHERE "createdAt" < ${cutoff} AND phone NOT LIKE 'anon:%'
  `;

  console.log(`Anonymized ${anonymizedCount} visitor(s).`);

  const deletedSequences = await prisma.dailySequence.deleteMany({
    where: { date: { lt: cutoff } },
  });

  console.log(`Deleted ${deletedSequences.count} old daily sequences.`);

  console.log('RGPD purge completed (tickets preserved for stats).');
}

main()
  .catch((e) => {
    console.error('Purge failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
