'use client';

import { useState, useEffect, useRef } from 'react';

export default function SettingsPanel() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [feedUrl, setFeedUrl] = useState('');
  const [feedSaved, setFeedSaved] = useState(false);
  const [feedMessage, setFeedMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [tickerText, setTickerText] = useState('');
  const [tickerSaved, setTickerSaved] = useState(false);
  const [tickerMessage, setTickerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [tickerLoading, setTickerLoading] = useState(false);

  useEffect(() => {
    checkLogo();
    loadFeedUrl();
    loadTicker();
  }, []);

  function checkLogo() {
    fetch('/api/logo')
      .then((res) => {
        if (res.ok) {
          setLogoUrl(`/api/logo?t=${Date.now()}`);
        } else {
          setLogoUrl(null);
        }
      })
      .catch(() => setLogoUrl(null));
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

  async function loadFeedUrl() {
    try {
      const res = await fetch('/api/admin/feed');
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          setFeedUrl(data.url);
          setFeedSaved(true);
        }
      }
    } catch {
      // ignore
    }
  }

  async function handleSaveFeed() {
    setFeedLoading(true);
    setFeedMessage(null);
    try {
      const res = await fetch('/api/admin/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: feedUrl }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedMessage({ type: 'success', text: 'Flux enregistre.' });
        setFeedSaved(true);
      } else {
        setFeedMessage({ type: 'error', text: data.error || 'Erreur.' });
      }
    } catch {
      setFeedMessage({ type: 'error', text: 'Erreur de connexion.' });
    } finally {
      setFeedLoading(false);
    }
  }

  async function loadTicker() {
    try {
      const res = await fetch('/api/admin/ticker');
      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setTickerText(data.message);
          setTickerSaved(true);
        }
      }
    } catch {
      // ignore
    }
  }

  async function handleSaveTicker() {
    setTickerLoading(true);
    setTickerMessage(null);
    try {
      const res = await fetch('/api/admin/ticker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: tickerText }),
      });
      const data = await res.json();
      if (res.ok) {
        setTickerMessage({ type: 'success', text: 'Message enregistre.' });
        setTickerSaved(true);
      } else {
        setTickerMessage({ type: 'error', text: data.error || 'Erreur.' });
      }
    } catch {
      setTickerMessage({ type: 'error', text: 'Erreur de connexion.' });
    } finally {
      setTickerLoading(false);
    }
  }

  async function handleDeleteTicker() {
    if (!confirm('Supprimer le message defilant ?')) return;
    try {
      const res = await fetch('/api/admin/ticker', { method: 'DELETE' });
      if (res.ok) {
        setTickerText('');
        setTickerSaved(false);
        setTickerMessage({ type: 'success', text: 'Message supprime.' });
      }
    } catch {
      setTickerMessage({ type: 'error', text: 'Erreur lors de la suppression.' });
    }
  }

  async function handleDeleteFeed() {
    if (!confirm('Supprimer le flux d\'actualites ?')) return;
    try {
      const res = await fetch('/api/admin/feed', { method: 'DELETE' });
      if (res.ok) {
        setFeedUrl('');
        setFeedSaved(false);
        setFeedMessage({ type: 'success', text: 'Flux supprime.' });
      }
    } catch {
      setFeedMessage({ type: 'error', text: 'Erreur lors de la suppression.' });
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

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-900">Parametres</h2>

      {/* Logo section */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          Logo de l'application
        </h3>
        <p className="mb-4 text-sm text-gray-500">
          Ce logo sera affiche sur l&apos;ecran public (Chromecast). Formats acceptes : PNG, JPG, SVG, WebP (max 2 Mo).
        </p>

        {/* Current logo preview */}
        {logoUrl && (
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-20 w-40 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-2">
              <img
                src={logoUrl}
                alt="Logo actuel"
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <button
              onClick={handleDelete}
              className="rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            >
              Supprimer
            </button>
          </div>
        )}

        {/* Upload */}
        <div className="flex items-center gap-3">
          <label className="cursor-pointer rounded-lg bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 transition-colors">
            {uploading ? 'Envoi en cours...' : logoUrl ? 'Changer le logo' : 'Ajouter un logo'}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>

        {/* Message */}
        {message && (
          <p className={`mt-3 text-sm ${
            message.type === 'success' ? 'text-green-600' : 'text-red-600'
          }`}>
            {message.text}
          </p>
        )}
      </div>
      {/* Feed URL section */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          Flux d&apos;actualites (affichage public)
        </h3>
        <p className="mb-4 text-sm text-gray-500">
          URL d&apos;un flux JSON d&apos;actualites a afficher dans un bandeau lateral sur l&apos;ecran public.
          Si vide, l&apos;ecran affiche uniquement le ticket en cours.
        </p>

        <div className="flex gap-2">
          <input
            type="url"
            value={feedUrl}
            onChange={(e) => { setFeedUrl(e.target.value); setFeedSaved(false); }}
            placeholder="https://www.ville-chatillon.fr/actualites/json"
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <button
            onClick={handleSaveFeed}
            disabled={feedLoading || !feedUrl || feedSaved}
            className="rounded-lg bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 transition-colors disabled:opacity-50"
          >
            {feedLoading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          {feedSaved && feedUrl && (
            <button
              onClick={handleDeleteFeed}
              className="rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              Supprimer
            </button>
          )}
        </div>

        {feedMessage && (
          <p className={`mt-3 text-sm ${
            feedMessage.type === 'success' ? 'text-green-600' : 'text-red-600'
          }`}>
            {feedMessage.text}
          </p>
        )}
      </div>

      {/* Ticker message section */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          Message defilant (affichage public)
        </h3>
        <p className="mb-4 text-sm text-gray-500">
          Message urgent qui defile en bas de l&apos;ecran public. Laissez vide pour ne rien afficher.
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={tickerText}
            onChange={(e) => { setTickerText(e.target.value); setTickerSaved(false); }}
            placeholder="Ex: Fermeture exceptionnelle a 16h aujourd'hui"
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <button
            onClick={handleSaveTicker}
            disabled={tickerLoading || !tickerText || tickerSaved}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition-colors disabled:opacity-50"
          >
            {tickerLoading ? 'Enregistrement...' : 'Publier'}
          </button>
          {tickerSaved && tickerText && (
            <button
              onClick={handleDeleteTicker}
              className="rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              Supprimer
            </button>
          )}
        </div>

        {tickerMessage && (
          <p className={`mt-3 text-sm ${
            tickerMessage.type === 'success' ? 'text-green-600' : 'text-red-600'
          }`}>
            {tickerMessage.text}
          </p>
        )}
      </div>
    </div>
  );
}
