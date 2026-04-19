import { randomUUID } from 'crypto';

/**
 * Logs an error with a short opaque id and returns the id.
 * Use the id in the client-facing response so the real error details
 * (stack, Prisma metadata) never leak while support can still correlate
 * the user report with server logs.
 */
export function logErrorWithId(context: string, error: unknown): string {
  const id = randomUUID().slice(0, 8);
  console.error(`[${id}] ${context}:`, error);
  return id;
}
