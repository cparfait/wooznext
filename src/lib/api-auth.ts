import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Get the authenticated agent session or null.
 * Use this in API routes that require agent authentication.
 */
export async function getAgentSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session;
}
