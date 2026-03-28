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

/**
 * Get admin session or null.
 * Returns session for ADMIN users (full access) or AGENT users (service-scoped).
 */
export async function getAdminSession() {
  const session = await getAgentSession();
  if (!session) return null;
  if (session.user.role !== 'ADMIN' && session.user.role !== 'AGENT') return null;
  return session;
}
