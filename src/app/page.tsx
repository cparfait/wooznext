import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import TicketForm from '@/components/visitor/TicketForm';
import { prisma } from '@/lib/prisma';

function VisitorPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <Suspense fallback={<div className="text-gray-400">Chargement...</div>}>
          <TicketForm />
        </Suspense>
      </div>
    </main>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const { service } = await searchParams;
  if (service) {
    return <VisitorPage />;
  }

  const adminCount = await prisma.agent.count({
    where: { role: 'ADMIN', isAnonymized: false },
  });
  if (adminCount === 0) {
    redirect('/setup');
  }

  redirect('/agent/login');
}
