/**
 * Midnight Cleanup Script
 *
 * Closes all remaining open tickets at the end of the day:
 * - WAITING tickets are set to CANCELLED
 * - SERVING tickets are set to NO_SHOW
 * - completedAt is set to now() for all updated tickets
 *
 * Run with: npx tsx scripts/midnight-cleanup.ts
 * Schedule as a daily cron job at midnight in production.
 */
import { PrismaClient, TicketStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  console.log(`[Midnight Cleanup] Starting at ${now.toISOString()}...`);

  // Close WAITING tickets as CANCELLED
  const cancelledResult = await prisma.ticket.updateMany({
    where: { status: TicketStatus.WAITING },
    data: {
      status: TicketStatus.CANCELLED,
      completedAt: now,
    },
  });

  console.log(`  ${cancelledResult.count} WAITING ticket(s) set to CANCELLED.`);

  // Close SERVING tickets as NO_SHOW
  const noShowResult = await prisma.ticket.updateMany({
    where: { status: TicketStatus.SERVING },
    data: {
      status: TicketStatus.NO_SHOW,
      completedAt: now,
    },
  });

  console.log(`  ${noShowResult.count} SERVING ticket(s) set to NO_SHOW.`);

  // Clear currentTicketId on all counters that referenced these tickets
  const clearedCounters = await prisma.counter.updateMany({
    where: { currentTicketId: { not: null } },
    data: { currentTicketId: null },
  });

  console.log(`  ${clearedCounters.count} counter(s) cleared.`);

  const total = cancelledResult.count + noShowResult.count;
  console.log(`[Midnight Cleanup] Done. ${total} ticket(s) closed.`);
}

main()
  .catch((e) => {
    console.error('Midnight cleanup failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
