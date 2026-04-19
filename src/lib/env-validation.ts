/**
 * Runtime validation of required environment variables.
 *
 * Called at server startup so a misconfigured deployment fails fast
 * with a clear message instead of crashing on the first DB/auth call.
 */
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'PHONE_PEPPER',
] as const;

export function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Variables d'environnement manquantes: ${missing.join(', ')}. ` +
        `Voir .env.example pour la liste complete.`
    );
  }

  const dbUrl = process.env.DATABASE_URL!;
  if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
    throw new Error(
      `DATABASE_URL doit commencer par postgresql:// ou postgres://. Valeur actuelle: "${dbUrl.slice(0, 20)}..."`
    );
  }

  // In production, NEXTAUTH_URL must use HTTPS (required for __Secure-/__Host-
  // cookie prefixes and SameSite=lax redirects).
  if (
    process.env.NODE_ENV === 'production' &&
    !process.env.NEXTAUTH_URL!.startsWith('https://')
  ) {
    console.warn(
      '[env] WARNING: NEXTAUTH_URL should start with https:// in production.'
    );
  }
}
