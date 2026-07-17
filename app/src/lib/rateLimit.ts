/**
 * S-07 FIX: Production-grade rate limiter.
 *
 * Uses @upstash/ratelimit + @upstash/redis when UPSTASH_REDIS_REST_URL is configured.
 * Falls back to the in-memory Map implementation for local dev / when Upstash is not set.
 *
 * Configuration via environment variables:
 *   UPSTASH_REDIS_REST_URL   — Upstash REST URL (from dashboard)
 *   UPSTASH_REDIS_REST_TOKEN — Upstash REST token (from dashboard)
 *
 * Free tier: 10K commands/day — enough for beta.
 */

// ── Types ───────────────────────────────────────────────────────────────────

interface RateLimitResult {
    limited: boolean;
    /** Remaining requests in the window */
    remaining: number;
    /** Unix ms when the window resets */
    resetAt: number;
}

interface RateLimiter {
    check(key: string): Promise<RateLimitResult>;
}

// ── Configuration ───────────────────────────────────────────────────────────

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 30;  // per wallet per window

// ── In-memory fallback (for local dev) ──────────────────────────────────────

function createMemoryLimiter(maxRequests: number, windowMs: number): RateLimiter {
    const map = new Map<string, { count: number; resetAt: number }>();
    let lastPrune = Date.now();
    const PRUNE_INTERVAL = 5 * 60_000;

    return {
        async check(key: string): Promise<RateLimitResult> {
            const now = Date.now();

            // Lazy prune
            if (now - lastPrune > PRUNE_INTERVAL) {
                lastPrune = now;
                map.forEach((v, k) => {
                    if (now >= v.resetAt) map.delete(k);
                });
            }

            const entry = map.get(key);
            if (!entry || now >= entry.resetAt) {
                map.set(key, { count: 1, resetAt: now + windowMs });
                return { limited: false, remaining: maxRequests - 1, resetAt: now + windowMs };
            }

            entry.count++;
            const remaining = Math.max(0, maxRequests - entry.count);
            return {
                limited: entry.count > maxRequests,
                remaining,
                resetAt: entry.resetAt,
            };
        },
    };
}

// ── Upstash Redis limiter ───────────────────────────────────────────────────

async function createUpstashLimiter(maxRequests: number, windowMs: number): Promise<RateLimiter | null> {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;

    try {
        const { Redis } = await import("@upstash/redis");
        const { Ratelimit } = await import("@upstash/ratelimit");

        const redis = new Redis({ url, token });
        const ratelimit = new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(maxRequests, `${windowMs / 1000} s`),
            analytics: true,
            prefix: `instinctfi:rl:${maxRequests}per${windowMs}`,
        });

        return {
            async check(key: string): Promise<RateLimitResult> {
                const result = await ratelimit.limit(key);
                return {
                    limited: !result.success,
                    remaining: result.remaining,
                    resetAt: result.reset,
                };
            },
        };
    } catch (e) {
        console.warn("[RateLimit] Failed to initialize Upstash — falling back to in-memory:", (e as Error).message);
        return null;
    }
}

// ── Limiter cache (one per max/window config) ───────────────────────────────

const _limiters = new Map<string, Promise<RateLimiter>>();

function getLimiter(maxRequests: number = MAX_REQUESTS, windowMs: number = WINDOW_MS): Promise<RateLimiter> {
    const cacheKey = `${maxRequests}:${windowMs}`;
    const cached = _limiters.get(cacheKey);
    if (cached) return cached;

    const initPromise = (async () => {
        const upstash = await createUpstashLimiter(maxRequests, windowMs);
        const limiter = upstash ?? createMemoryLimiter(maxRequests, windowMs);
        if (upstash) {
            console.log("[RateLimit] Using Upstash Redis rate limiter");
        } else {
            console.log("[RateLimit] Using in-memory rate limiter (dev/fallback)");
        }
        return limiter;
    })();

    _limiters.set(cacheKey, initPromise);
    return initPromise;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Check if a wallet has exceeded the rate limit.
 * Returns { limited, remaining, resetAt }.
 */
export async function checkRateLimit(wallet: string): Promise<RateLimitResult> {
    const limiter = await getLimiter();
    return limiter.check(wallet);
}

/**
 * Simple boolean check — backward compatible with old `isRateLimited(wallet)`.
 */
export async function isRateLimited(wallet: string): Promise<boolean> {
    const result = await checkRateLimit(wallet);
    return result.limited;
}

/**
 * Rate limit with a custom allowance (e.g. tighter for order submission,
 * looser for quote previews). Keys with different configs are tracked
 * independently, so prefix the key with the route, e.g. "v2-orders:<wallet>".
 */
export async function isRateLimitedCustom(
    key: string,
    maxRequests: number,
    windowMs: number = WINDOW_MS
): Promise<boolean> {
    const limiter = await getLimiter(maxRequests, windowMs);
    const result = await limiter.check(key);
    return result.limited;
}

/**
 * Best-effort client IP for anonymous (pre-auth) rate limiting.
 * Behind Vercel/most proxies the first x-forwarded-for entry is the client.
 */
export function getClientIp(req: { headers: { get(name: string): string | null } }): string {
    const fwd = req.headers.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0].trim();
    return req.headers.get("x-real-ip") ?? "unknown";
}
