import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { createHmac } from 'crypto';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Hashes a phone number with HMAC-SHA256 + PHONE_PEPPER for RGPD compliance.
 * The result is deterministic and can be used for database lookups.
 */
export function hashPhone(phone: string): string {
  const pepper = process.env.PHONE_PEPPER;
  if (!pepper) throw new Error('PHONE_PEPPER environment variable is not set');
  const normalized = phone.replace(/[\s\-\(\)\.]/g, '');
  return createHmac('sha256', pepper).update(normalized).digest('hex');
}

/**
 * Formats a ticket number to a 3-digit display code.
 * Example: 1 -> "001", 42 -> "042"
 */
export function formatTicketNumber(num: number, prefix?: string): string {
  const padded = String(num).padStart(3, '0');
  return prefix ? `${prefix}-${padded}` : padded;
}
