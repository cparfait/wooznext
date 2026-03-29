import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getDisplayData } from '@/lib/services/ticket.service';
import PublicDisplay from '@/components/display/PublicDisplay';

export const dynamic = 'force-dynamic';

interface DisplayServicePageProps {
  params: { serviceId: string };
}

export default async function DisplayServicePage({ params }: DisplayServicePageProps) {
  const service = await prisma.service.findUnique({
    where: { id: params.serviceId },
  });

  if (!service || !service.isActive) {
    notFound();
  }

  const data = await getDisplayData(service.id);

  return (
    <PublicDisplay
      serviceId={service.id}
      initialData={data}
      initialTickerMessage={service.tickerActive ? (service.tickerMessage ?? null) : null}
      initialTickerConfig={{
        position: service.tickerPosition as 'top' | 'middle' | 'bottom',
        height: service.tickerHeight,
        bgColor: service.tickerBgColor,
        textColor: service.tickerTextColor,
        fontSize: service.tickerFontSize,
      }}
      initialHasFeed={!!service.feedUrl && service.feedActive}
    />
  );
}
