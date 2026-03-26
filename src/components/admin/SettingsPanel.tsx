'use client';

import { useState, useEffect, useRef } from 'react';

export default function SettingsPanel() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkLogo();
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
          Logo de la collectivite
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
    </div>
  );
}
