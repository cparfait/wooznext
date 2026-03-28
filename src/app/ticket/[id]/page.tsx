import { notFound } from 'next/navigation';
import { getTicketById, getTicketPosition } from '@/lib/services/ticket.service';
import TicketTracker from '@/components/visitor/TicketTracker';

interface TicketPageProps {
  params: { id: string };
}

export default async function TicketPage({ params }: TicketPageProps) {
  const ticket = await getTicketById(params.id);

  if (!ticket) {
    notFound();
  }

  const position = await getTicketPosition(ticket.id);

  return (
    <TicketTracker
      ticketId={ticket.id}
      initialTicket={{
        id: ticket.id,
        displayCode: ticket.displayCode,
        status: ticket.status,
      }}
      initialPosition={position}
    />
  );
}
