'use client';

interface Ticket {
  id: string;
  displayCode: string;
  visitor: { phone: string };
  createdAt: string;
}

interface BottomSheetProps {
  visible: boolean;
  tickets: Ticket[];
  onCall: (ticketId: string) => void;
  onClose: () => void;
}

export default function BottomSheet({ visible, tickets, onCall, onClose }: BottomSheetProps) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Choisir visiteur(s)</h3>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
          >
            Fermer
          </button>
        </div>

        {tickets.length === 0 ? (
          <p className="py-8 text-center text-gray-400">Aucun visiteur en attente</p>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="flex items-center justify-between rounded-xl border border-gray-200 p-4"
              >
                <div>
                  <span className="text-2xl font-black tracking-wider text-gray-900">
                    {ticket.displayCode}
                  </span>
                  <p className="text-xs text-gray-400">
                    {new Date(ticket.createdAt).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <button
                  onClick={() => onCall(ticket.id)}
                  className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
                >
                  Appeler
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
