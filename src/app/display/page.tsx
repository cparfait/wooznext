import { prisma } from '@/lib/prisma';
import { getDisplayData } from '@/lib/services/ticket.service';
import PublicDisplay from '@/components/display/PublicDisplay';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function DisplayPage() {
  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  // If only one service, show it directly
  if (services.length === 1) {
    const service = services[0];
    const data = await getDisplayData(service.id);
    return (
      <PublicDisplay
        serviceId={service.id}
        serviceName={service.name}
        initialData={data}
      />
    );
  }

  // Multiple services: show a selection page
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white p-8">
      <h1 className="mb-12 text-4xl font-black text-gray-900">
        Affichage public
      </h1>
      <div className="grid gap-6">
        {services.map((service) => (
          <Link
            key={service.id}
            href={`/display/${service.id}`}
            className="rounded-2xl border-2 border-gray-200 px-12 py-8 text-center text-2xl font-bold text-gray-900 transition-colors hover:border-primary-500 hover:bg-primary-50"
          >
            {service.name}
          </Link>
        ))}
      </div>
    </main>
  );
}
