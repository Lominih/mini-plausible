import { Request, Response, NextFunction } from "express";

interface RateLimiterOptions {
  windowMs?: number;
  max?: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export function createRateLimiter(options: RateLimiterOptions = {}) {
  const windowMs = options.windowMs ?? 60000;
  const max = options.max ?? 100;
  const store = new Map<string, RateLimitEntry>();

  function cleanup() {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now >= entry.resetTime) {
        store.delete(key);
      }
    }
  }

  const cleanupInterval = setInterval(cleanup, windowMs);
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return function rateLimiter(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || req.socket.remoteAddress || "0.0.0.0";
    const now = Date.now();

    let entry = store.get(ip);

    if (!entry || now >= entry.resetTime) {
      entry = { count: 1, resetTime: now + windowMs };
      store.set(ip, entry);
    } else {
      entry.count++;
    }

    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

    if (entry.count > max) {
      res.setHeader("Retry-After", retryAfter);
      res.status(429).json({ error: "Too many requests", retryAfter });
      return;
    }

    next();
  };
}

export const globalLimiter = createRateLimiter({ windowMs: 60000, max: 100 });
export const eventLimiter = createRateLimiter({ windowMs: 60000, max: 300 });
export const authLimiter = createRateLimiter({ windowMs: 60000, max: 10 });
