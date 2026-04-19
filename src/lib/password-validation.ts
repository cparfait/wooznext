import { z } from 'zod';

/**
 * Shared password policy for all password entry points:
 * - agent creation (admin)
 * - agent update (admin)
 * - agent self-service change
 *
 * Accepts any non-alphanumeric character as a "special" char so accented
 * letters remain valid where users expect them.
 */
export const passwordSchema = z
  .string()
  .min(12, 'Mot de passe trop court (min 12 caracteres)')
  .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule')
  .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre')
  .regex(/[^A-Za-z0-9]/, 'Le mot de passe doit contenir au moins un caractere special');
