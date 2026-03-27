import { Suspense } from 'react';
import TicketForm from '@/components/visitor/TicketForm';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Bienvenue
          </h1>
        </div>

        <Suspense fallback={<div className="text-gray-400">Chargement...</div>}>
          <TicketForm />
        </Suspense>
      </div>
    </main>
  );
}
