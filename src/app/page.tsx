export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">
          Bienvenue
        </h1>
        <p className="text-gray-600">
          Prenez votre ticket pour la file d&apos;attente
        </p>

        {/* Phone input form will go here in Phase 6 */}
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-sm text-gray-400">
            Saisissez votre numéro de téléphone pour prendre un ticket
          </p>
        </div>
      </div>
    </main>
  );
}
