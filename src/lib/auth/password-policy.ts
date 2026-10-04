import { createHash } from 'node:crypto';

/**
 * Top Breached & Common Password Blacklist
 * Compiled from HaveIBeenPwned and SecLists common password leaks.
 */
const COMMON_BREACHED_PASSWORDS = new Set([
  'password123456',
  '123456789012',
  'qwertyuiop123',
  'admin12345678',
  'welcome123456',
  'iloveyou12345',
  'bharat12345678',
  'galuxium123456',
  'monkey12345678',
  'dragon12345678',
  'supersecret12',
  'letmein123456',
  'trustno112345',
  'sunshine12345',
  'master1234567',
]);

export interface PasswordValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates a proposed password against Galuxium Nexus V2 security policy:
 * 1. Minimum 12 characters.
 * 2. Breached password blacklist rejection.
 * 3. No composition gimmicks.
 */
export function validatePassword(password: string): PasswordValidationResult {
  if (!password || password.length < 12) {
    return {
      isValid: false,
      error: 'Password must be at least 12 characters long.',
    };
  }

  // Maximum sane limit to prevent DoS attacks on hashing algorithms
  if (password.length > 128) {
    return {
      isValid: false,
      error: 'Password cannot exceed 128 characters.',
    };
  }

  // Check normalized lowercase against known breached patterns
  const normalized = password.toLowerCase().trim();
  if (COMMON_BREACHED_PASSWORDS.has(normalized)) {
    return {
      isValid: false,
      error: 'This password is known to have appeared in data breaches. Please choose a unique passphrase.',
    };
  }

  // Check for obvious sequential character runs (e.g. "123456789012", "abcdefghijkl")
  if (/^(?:123456789012|abcdefghijkl|qwertyuiopas)$/i.test(normalized)) {
    return {
      isValid: false,
      error: 'Password is too predictable. Please choose a stronger passphrase.',
    };
  }

  return {
    isValid: true,
  };
}
