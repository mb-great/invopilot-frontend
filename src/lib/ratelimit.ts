const store = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hit = store.get(key);
  if (!hit || now > hit.reset) { store.set(key, { count: 1, reset: now + windowMs }); return true; }
  if (hit.count >= limit) return false;
  hit.count++;
  return true;
}

// Prevent Map memory leak
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) if (now > v.reset) store.delete(k);
}, 300_000);
