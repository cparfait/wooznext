'use client';

import { useState, useEffect, useRef } from 'react';

interface CronJob {
  id: string;
  name: string;
  label: string;
  schedule: string;
  enabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastRunResult: string | null;
}

export default function SettingsPanel() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [cronLoading, setCronLoading] = useState(true);
  const [cronSaving, setCronSaving] = useState<string | null>(null);
  const [cronRunning, setCronRunning] = useState<string | null>(null);
  const [cronMsg, setCronMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    checkLogo();
    fetchCronJobs();
  }, []);

  function checkLogo() {
    fetch(`/api/logo?t=${Date.now()}`)
      .then((res) => {
        if (res.ok && res.headers.get('content-type')?.startsWith('image/')) {
          setLogoUrl(`/api/logo?t=${Date.now()}`);
        } else {
          setLogoUrl(null);
        }
      })
      .catch(() => setLogoUrl(null));
  }

  async function fetchCronJobs() {
    setCronLoading(true);
    try {
      const res = await fetch('/api/admin/cron');
      if (res.ok) {
        const data = await res.json();
        setCronJobs(data.jobs);
      }
    } catch {}
    setCronLoading(false);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('logo', file);

    try {
      const res = await fetch('/api/admin/logo', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: 'Logo mis a jour avec succes.' });
        checkLogo();
      } else {
        setMessage({ type: 'error', text: data.error || 'Erreur lors de l\'envoi.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Erreur de connexion.' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDelete() {
    if (!confirm('Supprimer le logo ?')) return;

    try {
      const res = await fetch('/api/admin/logo', { method: 'DELETE' });
      if (res.ok) {
        setLogoUrl(null);
        setMessage({ type: 'success', text: 'Logo supprime.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Erreur lors de la suppression.' });
    }
  }

  async function handleCronUpdate(name: string, field: 'schedule' | 'enabled', value: string | boolean) {
    const job = cronJobs.find((j) => j.name === name);
    if (!job) return;

    setCronSaving(name);
    setCronMsg(null);

    const res = await fetch('/api/admin/cron', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        schedule: field === 'schedule' ? value : job.schedule,
        enabled: field === 'enabled' ? value : job.enabled,
      }),
    });

    if (res.ok) {
      setCronJobs((prev) =>
        prev.map((j) => (j.name === name ? { ...j, [field]: value } : j))
      );
      setCronMsg({ type: 'success', text: 'Tache mise a jour.' });
    } else {
      const data = await res.json();
      setCronMsg({ type: 'error', text: data.error || 'Erreur.' });
    }
    setCronSaving(null);
    setTimeout(() => setCronMsg(null), 3000);
  }

  async function handleCronRun(name: string) {
    setCronRunning(name);
    setCronMsg(null);

    const res = await fetch('/api/admin/cron', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    if (res.ok) {
      const data = await res.json();
      setCronMsg({ type: 'success', text: `Tache executee : ${data.result}` });
      await fetchCronJobs();
    } else {
      const data = await res.json();
      setCronMsg({ type: 'error', text: data.error || 'Erreur.' });
    }
    setCronRunning(null);
    setTimeout(() => setCronMsg(null), 5000);
  }

  function formatDate(iso: string | null): string {
    if (!iso) return 'Jamais';
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-900">Parametres</h2>

      {/* Scheduled tasks */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          Taches planifiees
        </h3>
        <p className="mb-4 text-sm text-gray-500">
          Configurez les taches automatiques. Format cron :&nbsp;
          <code className="rounded bg-gray-100 px-1 text-xs">min heure jour mois jour-semaine</code>
          &nbsp;(ex: <code className="rounded bg-gray-100 px-1 text-xs">0 0 * * *</code> = tous les jours a minuit).
        </p>

        {cronLoading ? (
          <div className="flex justify-center py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-4">
            {cronJobs.map((job) => (
              <div key={job.name} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleCronUpdate(job.name, 'enabled', !job.enabled)}
                      disabled={cronSaving === job.name}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                        job.enabled
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                      }`}
                    >
                      {job.enabled ? 'Active' : 'Desactive'}
                    </button>
                    <span className="text-sm font-medium text-gray-800">{job.label}</span>
                  </div>
                  <button
                    onClick={() => handleCronRun(job.name)}
                    disabled={cronRunning === job.name || !job.enabled}
                    className="rounded-lg bg-primary-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-600 disabled:opacity-50"
                  >
                    {cronRunning === job.name ? 'Execution...' : 'Executer'}
                  </button>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <label className="text-xs text-gray-500">Planning :</label>
                  <input
                    type="text"
                    value={job.schedule}
                    onChange={(e) => {
                      setCronJobs((prev) =>
                        prev.map((j) => (j.name === job.name ? { ...j, schedule: e.target.value } : j))
                      );
                    }}
                    onBlur={(e) => {
                      if (e.target.value !== job.schedule) {
                        handleCronUpdate(job.name, 'schedule', e.target.value);
                      }
                    }}
                    className="h-8 w-36 rounded border border-gray-300 bg-white px-2 text-xs font-mono focus:border-primary-500 focus:outline-none"
                  />
                  <span className="text-xs text-gray-400">
                    {job.schedule === '0 0 * * *' && 'Tous les jours a minuit'}
                    {job.schedule === '0 3 * * *' && 'Tous les jours a 3h'}
                  </span>
                </div>

                <div className="mt-3 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>Derniere execution :</span>
                    <span className="font-medium text-gray-700">{formatDate(job.lastRunAt)}</span>
                    {job.lastRunStatus && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          job.lastRunStatus === 'success'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {job.lastRunStatus === 'success' ? 'Succes' : 'Erreur'}
                      </span>
                    )}
                  </div>
                  {job.lastRunResult && (
                    <p className="text-xs text-gray-400 truncate" title={job.lastRunResult}>
                      {job.lastRunResult}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {cronMsg && (
          <p className={`mt-3 text-sm ${cronMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {cronMsg.text}
          </p>
        )}
      </div>

      {/* Logo section */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          Logo de l&apos;application
        </h3>
        <p className="mb-4 text-sm text-gray-500">
          Ce logo sera affiche sur l&apos;ecran public (Chromecast). Formats acceptes : PNG, JPG, WebP (max 2 Mo).
        </p>

        {logoUrl && (
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-20 w-40 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt=""
                className="max-h-full max-w-full object-contain"
                onError={() => setLogoUrl(null)}
              />
            </div>
            <button
              onClick={handleDelete}
              className="h-10 rounded-lg px-3 text-sm text-red-600 hover:bg-red-50"
            >
              Supprimer
            </button>
          </div>
        )}

        <div className="flex items-center gap-3">
          <label className="h-10 inline-flex cursor-pointer items-center rounded-lg bg-primary-700 px-4 text-sm font-medium text-white hover:bg-primary-600 transition-colors">
            {uploading ? 'Envoi en cours...' : logoUrl ? 'Changer le logo' : 'Ajouter un logo'}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>

        {message && (
          <p className={`mt-3 text-sm ${
            message.type === 'success' ? 'text-green-600' : 'text-red-600'
          }`}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
