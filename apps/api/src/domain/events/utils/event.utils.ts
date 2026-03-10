/**
 * Generate a random short slug for events
 * @param length - Length of the slug (default: 6)
 * @returns A random alphanumeric string
 */
export function generateShortSlug(length: number = 6): string {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters[randomIndex];
  }

  return result;
}

/**
 * Sanitize user input to prevent XSS and injection attacks
 * @param input - User input string
 * @returns Sanitized string
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';

  return input
    .trim()
    .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
    .slice(0, 10000); // Limit length to prevent DoS
}

/**
 * Validate URL format
 * @param url - URL string to validate
 * @returns boolean
 */
export function isValidUrl(url: string): boolean {
  if (!url || url.trim() === '') return false;

  // Allow relative URLs that start with /
  if (url.startsWith('/')) {
    return true;
  }

  // Validate absolute URLs
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
}

/**
 * Generate a unique event code for sharing
 * Format: XX-XXXX (e.g., AB-C123)
 */
export function generateEventCode(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const alphanumeric = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  let code = '';

  // First 2 characters: letters only
  for (let i = 0; i < 2; i++) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }

  code += '-';

  // Last 4 characters: alphanumeric
  for (let i = 0; i < 4; i++) {
    code += alphanumeric[Math.floor(Math.random() * alphanumeric.length)];
  }

  return code;
}
