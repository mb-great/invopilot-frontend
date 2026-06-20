/**
 * Shared URL resolution utilities.
 * In production: throws if env vars are missing (fail-fast).
 * In development: falls back to localhost defaults.
 */

const isDev = process.env.NODE_ENV === 'development';

/**
 * Get the backend API URL (Express server).
 * FE uses NEXT_PUBLIC_BACKEND_URL, BE uses BACKEND_URL.
 */
export function getBackendUrl(): string {
  const url = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
  if (url) return url.replace(/\/$/, '');
  if (isDev) return 'http://localhost:3002';
  throw new Error('[URL] BACKEND_URL or NEXT_PUBLIC_BACKEND_URL must be set in production');
}

/**
 * Get the frontend URL (Next.js app).
 * Used for CORS origins, redirect URLs, share links.
 */
export function getFrontendUrl(): string {
  // Server-side: use env vars
  if (typeof window === 'undefined') {
    const url = process.env.NEXT_PUBLIC_SITE_URL || process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL;
    if (url) return url.replace(/\/$/, '');
    if (isDev) return 'http://localhost:3001';
    throw new Error('[URL] FRONTEND_URL or NEXT_PUBLIC_SITE_URL must be set in production');
  }

  // Client-side: prefer env var if origin is non-standard (0.0.0.0, etc.)
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_FRONTEND_URL;
  const origin = window.location.origin;
  if (envUrl && (origin.includes('0.0.0.0') || origin.includes('127.0.0.1'))) {
    return envUrl.replace(/\/$/, '');
  }
  return origin;
}
