import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import AgentDashboard from '@/components/agent/AgentDashboard';

export default async function AgentPage() {
  const session = await getServerSession(authOptions);

  return <AgentDashboard session={session!} />;
}
