/**
 * Decides whether this SIGNED_IN event is a genuine signup.
 *
 * The bug this replaces: AnalyticsAuthListener guarded with a useRef, which
 * resets on every mount. Supabase emits SIGNED_IN on each page load, so an
 * already-registered user re-fired signup_completed every time they navigated.
 * One account recorded it three times in a few minutes, inflating both the
 * signup count and the unique-user count.
 *
 * Two independent guards, because either alone leaks:
 *   1. created_at window — is this account actually new?
 *   2. persisted flag    — has it already fired for this user on this device?
 *
 * The window alone re-fires on reload within the window. The flag alone would
 * fire once for every existing user the first time they visit after deploy.
 */

/** How recently an account must have been created to count as "just signed up". */
export const NEW_USER_WINDOW_MS = 5 * 60 * 1000;

const KEY_PREFIX = 'invopilot_signup_tracked:';

type MinimalStorage = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): MinimalStorage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null; // private mode / storage disabled
  }
}

/** Record that signup_completed has fired for this user. Never throws. */
export function markSignupFired(userId: string, storage: MinimalStorage | null = defaultStorage()): void {
  try {
    storage?.setItem(KEY_PREFIX + userId, '1');
  } catch {
    /* storage unavailable — the created_at window still bounds the damage */
  }
}

export function shouldFireSignupCompleted(args: {
  userId: string;
  createdAt: string | undefined;
  now?: number;
  storage?: MinimalStorage | null;
}): boolean {
  const { userId, createdAt } = args;
  const now = args.now ?? Date.now();
  const storage = args.storage === undefined ? defaultStorage() : args.storage;

  // No creation timestamp means we cannot prove this is a new account. Staying
  // silent is correct: a missed signup understates the funnel, a false one
  // corrupts it, and the second is the harder error to notice.
  if (!createdAt) return false;

  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return false;
  if (now - created > NEW_USER_WINDOW_MS) return false;

  try {
    if (storage?.getItem(KEY_PREFIX + userId)) return false;
  } catch {
    /* unreadable storage — fall through and rely on the window */
  }

  return true;
}
