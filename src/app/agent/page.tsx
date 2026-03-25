export default function AgentPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-400 p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <p className="text-sm text-gray-600">
          Il n&apos;y a pas de visiteurs qui attendent
        </p>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-gray-900">
            Actuellement en service
          </h2>
          <div className="mx-auto rounded-xl bg-gray-300/50 px-12 py-6">
            <span className="text-8xl font-black tracking-wider text-gray-900">
              000
            </span>
          </div>
        </div>

        {/* Agent controls will be implemented in Phase 7 */}
        <button
          className="w-full rounded-xl bg-primary-500 py-4 text-lg font-semibold text-white shadow-md"
          disabled
        >
          Suivant
        </button>
      </div>
    </main>
  );
}
