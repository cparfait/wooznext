import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a ticket number to a 3-digit display code.
 * Example: 1 -> "001", 42 -> "042"
 */
export function formatTicketNumber(num: number, prefix?: string): string {
  const padded = String(num).padStart(3, '0');
  return prefix ? `${prefix}-${padded}` : padded;
}
