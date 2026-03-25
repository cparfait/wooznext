'use client';

import { useState, useEffect } from 'react';

interface Stats {
  totalToday: number;
  completedToday: number;
  noShowToday: number;
  waitingNow: number;
  servingNow: number;
  avgServiceTimeSeconds: number;
  perService: { id: string; name: string; total: number; completed: number; waiting: number }[];
}

export default function StatsPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  async function fetchStats() {
    const res = await fetch('/api/admin/stats');
    if (res.ok) setStats(await res.json());
  }

  async function handleReset() {
    if (!confirm('Reinitialiser toute la file ? Tous les tickets en attente seront annules.')) return;
    setResetting(true);
    await fetch('/api/admin/reset', { method: 'POST' });
    await fetchStats();
    setResetting(false);
  }

  function formatTime(seconds: number) {
    if (seconds === 0) return '--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}min ${s}s`;
  }

  if (!stats) return <p className="py-8 text-center text-gray-400">Chargement...</p>;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card label="Tickets du jour" value={stats.totalToday} />
        <Card label="Termines" value={stats.completedToday} color="text-green-600" />
        <Card label="Absents" value={stats.noShowToday} color="text-red-500" />
        <Card label="En attente" value={stats.waitingNow} color="text-orange-500" />
        <Card label="En service" value={stats.servingNow} color="text-primary-500" />
        <Card label="Temps moyen" value={formatTime(stats.avgServiceTimeSeconds)} />
      </div>

      {/* Per service */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Par service</h3>
        <div className="space-y-2">
          {stats.perService.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
              <span className="font-medium text-gray-900">{s.name}</span>
              <div className="flex gap-4 text-sm text-gray-500">
                <span>{s.total} total</span>
                <span className="text-green-600">{s.completed} termines</span>
                <span className="text-orange-500">{s.waiting} en attente</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reset */}
      <button
        onClick={handleReset}
        disabled={resetting}
        className="w-full rounded-xl border border-red-300 bg-red-50 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
      >
        {resetting ? 'Reinitialisation...' : 'Reinitialiser la file'}
      </button>
    </div>
  );
}

function Card({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${color ?? 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
