const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;
// 行が増えすぎないようにする。長く動き続けても、IP の数だけ Map が大きくならない
const SWEEP_THRESHOLD = 1_000;
const MAX_ENTRIES = 10_000;
const attempts = new Map<string, { count: number; resetAt: number }>();

export function clientIp(request: Request): string {
  return (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown").slice(0, 64);
}

// 1,000 行を超えたら期限切れの行を消し、それでも 10,000 行を超えるなら古い（resetAt が早い）順に消す。
// 制限中（期限内）の行は、10,000 行を超えない限り消さない。
function pruneAttempts(now: number): void {
  if (attempts.size <= SWEEP_THRESHOLD) return;
  for (const [key, record] of attempts) {
    if (record.resetAt <= now) attempts.delete(key);
  }
  const excess = attempts.size - MAX_ENTRIES;
  if (excess <= 0) return;
  const oldest = [...attempts.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt).slice(0, excess);
  for (const [key] of oldest) attempts.delete(key);
}

export function checkSignRateLimit(ip: string, now = Date.now()): boolean {
  const allowed = countAttempt(ip, now);
  pruneAttempts(now);
  return allowed;
}

function countAttempt(ip: string, now: number): boolean {
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

export function signRateLimitSizeForTests(): number {
  return attempts.size;
}
