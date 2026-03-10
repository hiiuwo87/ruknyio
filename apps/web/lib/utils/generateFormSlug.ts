const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generate a unique 10-character alphanumeric slug for forms.
 */
export function generateFormSlug(): string {
  const arr = new Uint8Array(10);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < 10; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr, (b) => CHARS[b % CHARS.length]).join('');
}

/**
 * Validate slug format: 3-30 chars, lowercase alphanumeric + hyphens.
 */
export function isValidFormSlug(slug: string): boolean {
  return /^[a-z0-9-]{3,30}$/.test(slug);
}
