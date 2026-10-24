const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, { count: number; resetAt: number }>();

export function clientIp(request: Request): string {
  return (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown").slice(0, 64);
}

export function checkSignRateLimit(ip: string, now = Date.now()): boolean {
  const record = attempts.get(ip);
  if (!record || now >= record.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (record.count >= MAX_ATTEMPTS) return false;
  record.count += 1;
  return true;
}

export function resetSignRateLimitForTests(): void {
  attempts.clear();
}
