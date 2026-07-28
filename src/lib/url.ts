/**
 * Shared URL resolution utilities.
 * Env vars MUST be set. No hardcoded fallbacks.
 */

/**
 * Get the backend API URL (Express server).
 */
export function getBackendUrl(): string {
  const url = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
  if (url) return url.replace(/\/$/, '');
  throw new Error('[URL] BACKEND_URL or NEXT_PUBLIC_BACKEND_URL must be set');
}

/**
 * Get the frontend URL (Next.js app).
 */
export function getFrontendUrl(): string {
  const url = process.env.NEXT_PUBLIC_FRONTEND_URL;
  if (url) return url.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  throw new Error('[URL] NEXT_PUBLIC_FRONTEND_URL must be set');
}
