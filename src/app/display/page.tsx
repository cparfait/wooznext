export default function DisplayPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white p-8">
      <div className="space-y-12 text-center">
        <div>
          <h1 className="text-4xl font-black text-gray-900">
            Numéro du visiteur en cours
          </h1>
          <p className="mt-8 text-[12rem] font-black leading-none tracking-wider text-gray-900">
            000
          </p>
        </div>

        <div>
          <p className="text-3xl font-bold text-gray-900">
            Visiteur suivant :
          </p>
          <p className="mt-4 text-7xl font-black tracking-wider text-gray-500">
            ---
          </p>
        </div>

        <p className="text-2xl text-gray-700">
          Il y a <strong>0 visiteur</strong> en attente
        </p>
      </div>
    </main>
  );
}
