'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTicketSocket } from '@/hooks/useSocket';
import ProgressCircle from './ProgressCircle';
import CelebrationPopup from './CelebrationPopup';

interface TicketData {
  id: string;
  displayCode: string;
  status: string;
  service: { name: string };
}

interface TicketTrackerProps {
  ticketId: string;
  initialTicket: TicketData;
  initialPosition: number;
}

export default function TicketTracker({
  ticketId,
  initialTicket,
  initialPosition,
}: TicketTrackerProps) {
  const [ticket, setTicket] = useState(initialTicket);
  const [position, setPosition] = useState(initialPosition);
  const [showCelebration, setShowCelebration] = useState(false);

  const isCurrent = ticket.status === 'SERVING';
  const isFinished = ticket.status === 'COMPLETED' || ticket.status === 'CANCELLED' || ticket.status === 'NO_SHOW';

  // Refresh ticket data from API
  const refreshTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`);
      if (!res.ok) return;
      const data = await res.json();
      setTicket(data.ticket);
      setPosition(data.position);
    } catch {
      // Silently fail, will retry on next event
    }
  }, [ticketId]);

  // Socket.IO events
  useTicketSocket(ticketId, useCallback((event: string) => {
    if (event === 'ticket:called') {
      setShowCelebration(true);
      refreshTicket();
    } else if (event === 'ticket:completed' || event === 'ticket:no-show') {
      refreshTicket();
    } else if (event === 'ticket:returned') {
      setShowCelebration(false);
      refreshTicket();
    }
  }, [refreshTicket]));

  // Also listen for queue updates to refresh position
  useEffect(() => {
    if (ticket.status !== 'WAITING') return;
    const interval = setInterval(refreshTicket, 15000);
    return () => clearInterval(interval);
  }, [ticket.status, refreshTicket]);

  // Show celebration on mount if already being served
  useEffect(() => {
    if (isCurrent) setShowCelebration(true);
  }, [isCurrent]);

  if (isFinished) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Visite terminee
          </h1>
          <p className="text-gray-600">
            Votre ticket <strong>#{ticket.displayCode}</strong> est cloture.
          </p>
          <p className="text-sm text-gray-400">
            Merci de votre visite.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        {/* Service name */}
        <p className="text-sm font-medium text-gray-500">
          {ticket.service.name}
        </p>

        {/* Progress circle */}
        <ProgressCircle
          position={position}
          total={position}
          isCurrent={isCurrent}
        />

        {/* Ticket number */}
        <div>
          <p className="text-gray-600">Votre numero est le</p>
          <p className="text-4xl font-black tracking-wider text-gray-900">
            #{ticket.displayCode}
          </p>
        </div>

        {/* Status message */}
        {isCurrent ? (
          <p className="text-lg font-semibold text-green-500">
            On vous a appele !
          </p>
        ) : (
          <p className="text-sm text-gray-400">
            Restez sur cette page, vous serez notifie quand ce sera votre tour.
          </p>
        )}
      </div>

      <CelebrationPopup
        visible={showCelebration && isCurrent}
        onClose={() => setShowCelebration(false)}
      />
    </div>
  );
}
