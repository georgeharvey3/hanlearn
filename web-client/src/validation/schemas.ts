import { z } from 'zod';

/**
 * Strip control characters (except common whitespace: space, tab, newline)
 * from a string to prevent injection of invisible/malicious characters.
 */
function stripControlChars(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

// --- Auth schemas ---

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .max(254, 'Email is too long')
  .email('Invalid email address');

export const passwordSchema = z
  .string()
  .min(1, 'Password is required')
  .max(128, 'Password is too long');

export const registerPasswordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .max(128, 'Password is too long');

export const usernameSchema = z
  .string()
  .trim()
  .min(1, 'Username is required')
  .max(50, 'Username must be 50 characters or less')
  .transform(stripControlChars);

// --- Word/meaning schemas ---

export const amendedMeaningSchema = z
  .string()
  .trim()
  .max(500, 'Meaning must be 500 characters or less')
  .transform(stripControlChars);

export const searchInputSchema = z
  .string()
  .trim()
  .max(100, 'Search input is too long')
  .transform(stripControlChars);

export const customWordTextSchema = z
  .string()
  .trim()
  .min(1, 'Word text is required')
  .max(50, 'Word text must be 50 characters or less')
  .transform(stripControlChars);

export const customWordMeaningSchema = z
  .string()
  .trim()
  .min(1, 'Meaning is required')
  .max(500, 'Meaning must be 500 characters or less')
  .transform(stripControlChars);
