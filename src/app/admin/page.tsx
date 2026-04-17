import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import AdminDashboard from '@/components/admin/AdminDashboard';

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'AGENT')) {
    redirect('/agent/login');
  }

  return (
    <AdminDashboard
      userId={session.user.id}
      userRole={session.user.role}
      userServiceId={session.user.serviceId ?? null}
    />
  );
}
