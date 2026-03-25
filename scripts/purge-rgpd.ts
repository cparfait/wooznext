/**
 * RGPD Purge Script
 *
 * Deletes visitor data older than 30 days.
 * Run with: npx tsx scripts/purge-rgpd.ts
 * Schedule as a daily cron job in production.
 */
import { PrismaClient, TicketStatus } from '@prisma/client';

const prisma = new PrismaClient();

const RETENTION_DAYS = 30;

async function main() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  console.log(`Purging data older than ${cutoff.toISOString()} (${RETENTION_DAYS} days)...`);

  // Delete old tickets (completed, cancelled, no-show)
  const deletedTickets = await prisma.ticket.deleteMany({
    where: {
      createdAt: { lt: cutoff },
      status: {
        in: [TicketStatus.COMPLETED, TicketStatus.CANCELLED, TicketStatus.NO_SHOW],
      },
    },
  });

  console.log(`Deleted ${deletedTickets.count} old tickets.`);

  // Delete old daily sequences
  const deletedSequences = await prisma.dailySequence.deleteMany({
    where: { date: { lt: cutoff } },
  });

  console.log(`Deleted ${deletedSequences.count} old daily sequences.`);

  // Delete visitors with no remaining tickets
  const orphanedVisitors = await prisma.visitor.deleteMany({
    where: {
      tickets: { none: {} },
      createdAt: { lt: cutoff },
    },
  });

  console.log(`Deleted ${orphanedVisitors.count} orphaned visitors.`);

  console.log('RGPD purge completed.');
}

main()
  .catch((e) => {
    console.error('Purge failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
