'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useServicesSocket, useAdminPresenceSocket } from '@/hooks/useSocket';

interface WaitingTicket {
  id: string;
  displayCode: string;
  createdAt: string;
  returnedToQueue: boolean;
  returnReason: string | null;
  online: boolean;
}

interface ServingTicket {
  id: string;
  displayCode: string;
  calledAt: string | null;
  counterLabel: string | null;
  agentName: string | null;
  online: boolean;
}

interface AgentPresence {
  id: string;
  name: string;
  online: boolean;
  counterLabel: string | null;
}

interface ServiceQueue {
  id: string;
  name: string;
  prefix: string;
  agents: AgentPresence[];
  waiting: WaitingTicket[];
  serving: ServingTicket[];
}

interface Summary {
  agentsOnline: number;
  visitorsOnline: number;
  waiting: number;
}

// Filet de securite si un evenement Socket.IO est manque (reset, nettoyage minuit...)
const REFRESH_INTERVAL_MS = 15000;
// Regroupe les rafales d'evenements (appel + mise a jour de file) en une seule requete
const SOCKET_DEBOUNCE_MS = 300;

function formatWait(fromIso: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 60000));
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}

function formatHour(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function plural(n: number, word: string) {
  return `${n} ${word}${n > 1 ? 's' : ''}`;
}

function OnlineDot({ online, title }: { online: boolean; title: string }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${online ? 'bg-green-500' : 'bg-gray-300'}`}
      title={title}
    />
  );
}

export default function QueuePanel() {
  const [services, setServices] = useState<ServiceQueue[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/queue');
      if (!res.ok) {
        setError(true);
        return;
      }
      const data = await res.json();
      setServices(data.services);
      setSummary(data.summary);
      setError(false);
      setNow(Date.now());
    } catch {
      setError(true);
    }
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchQueue, SOCKET_DEBOUNCE_MS);
  }, [fetchQueue]);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, REFRESH_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchQueue]);

  useServicesSocket(services?.map((s) => s.id) ?? [], scheduleRefresh);
  useAdminPresenceSocket(scheduleRefresh);

  if (!services || !summary) {
    return (
      <p className="py-8 text-center text-gray-400">
        {error ? 'Impossible de charger la file d\'attente.' : 'Chargement...'}
      </p>
    );
  }

  const nobodyOnline = summary.agentsOnline === 0 && summary.visitorsOnline === 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Agents en ligne" value={summary.agentsOnline} color="text-green-600" />
        <SummaryCard label="Visiteurs en ligne" value={summary.visitorsOnline} color="text-green-600" />
        <SummaryCard label="En attente" value={summary.waiting} color="text-orange-500" />
      </div>

      {/* Presence status (utile avant de deployer une mise a jour) */}
      <div
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
          nobodyOnline
            ? 'border-primary-200 bg-primary-50 text-primary-800'
            : 'border-orange-200 bg-orange-50 text-orange-800'
        }`}
      >
        <OnlineDot online={!nobodyOnline} title="" />
        {nobodyOnline ? (
          <p>
            <span className="font-semibold">Personne n&apos;est connecte.</span>{' '}
            Une mise a jour peut etre deployee sans gener d&apos;agent ni de visiteur.
          </p>
        ) : (
          <p>
            <span className="font-semibold">
              {plural(summary.agentsOnline, 'agent')} et {plural(summary.visitorsOnline, 'visiteur')} en ligne.
            </span>{' '}
            Une mise a jour les deconnecterait momentanement.
          </p>
        )}
        {error && (
          <span className="ml-auto text-xs text-red-500">Connexion perdue, nouvelle tentative...</span>
        )}
      </div>

      {services.length === 0 ? (
        <p className="py-8 text-center text-gray-400">Aucun service actif.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {services.map((service) => (
            <section key={service.id} className="flex flex-col rounded-xl bg-white shadow-sm">
              {/* Service header */}
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-gray-900">{service.name}</h3>
                  {service.prefix && <p className="text-xs text-gray-400">Prefixe {service.prefix}</p>}
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${
                    service.waiting.length > 0
                      ? 'bg-orange-50 text-orange-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {service.waiting.length} en attente
                </span>
              </div>

              {/* Agents */}
              <div className="space-y-1 border-b border-gray-100 px-4 py-2">
                {service.agents.length === 0 ? (
                  <p className="text-xs text-gray-400">Aucun agent rattache</p>
                ) : (
                  service.agents.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 text-xs">
                      <OnlineDot online={a.online} title={a.online ? 'Tableau de bord agent ouvert' : 'Hors ligne'} />
                      <span className={a.online ? 'font-medium text-gray-800' : 'text-gray-400'}>{a.name}</span>
                      <span className="ml-auto text-gray-400">
                        {a.online ? (a.counterLabel ?? 'Sans guichet') : 'Hors ligne'}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Currently serving */}
              {service.serving.length > 0 && (
                <div className="space-y-1 border-b border-gray-100 bg-primary-50 px-4 py-2">
                  {service.serving.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 text-xs text-primary-800">
                      <OnlineDot online={t.online} title={t.online ? 'Page de suivi ouverte' : 'Page de suivi fermee'} />
                      <p>
                        En service : <span className="font-bold">{t.displayCode}</span>
                        {t.counterLabel && <> -- {t.counterLabel}</>}
                        {t.agentName && <span className="text-primary-600"> ({t.agentName})</span>}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Waiting list */}
              {service.waiting.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-gray-400">Aucun ticket en attente</p>
              ) : (
                <ol className="max-h-96 divide-y divide-gray-50 overflow-y-auto">
                  {service.waiting.map((t, index) => (
                    <li key={t.id} className="flex items-center gap-3 px-4 py-2">
                      <span className="w-6 text-right text-xs text-gray-400">{index + 1}</span>
                      <OnlineDot online={t.online} title={t.online ? 'Page de suivi ouverte' : 'Page de suivi fermee'} />
                      <span className="text-xl font-black tracking-wider text-gray-900">{t.displayCode}</span>
                      {t.returnedToQueue && (
                        <span
                          className="rounded bg-accent-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-accent-700"
                          title={t.returnReason ?? undefined}
                        >
                          Renvoye
                        </span>
                      )}
                      <span className="ml-auto text-right text-xs text-gray-500">
                        {formatHour(t.createdAt)}
                        <span className="block font-medium text-gray-700">{formatWait(t.createdAt, now)}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ))}
        </div>
      )}

      <p className="flex items-center gap-2 text-xs text-gray-400">
        <OnlineDot online title="" /> En ligne : tableau de bord agent ou page de suivi du ticket ouvert
      </p>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${value > 0 ? color : 'text-gray-300'}`}>{value}</p>
    </div>
  );
}
