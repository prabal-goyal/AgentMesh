import type { Request, Response, NextFunction } from 'express'

// Same sliding-window shape as rateLimit.ts, but keyed on userId instead of
// IP. That difference is the whole point: rateLimit guards login against
// brute force, this guards our provider keys against spend. An attacker with
// one valid account rotating IPs defeats a per-IP limit but not this one.
//
// In-memory, so counters reset when Render restarts the instance and would
// count separately across multiple instances. Acceptable for a spend guard
// today; the `runs` table (backlog item 2) is where this becomes durable.
interface QuotaOptions {
  windowMs:    number
  maxRequests: number
  label:       string  // used in the 429 message, e.g. 'workflow runs'
}

export function createUserQuota({ windowMs, maxRequests, label }: QuotaOptions) {
  const usage = new Map<string, { count: number; resetAt: number }>()

  // Sweep expired entries so the map doesn't grow forever, matching rateLimit.ts.
  // unref() so this timer alone never keeps the process alive — without it a
  // test run (or any short-lived import of this module) hangs waiting on it.
  const sweep = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of usage) {
      if (now > entry.resetAt) usage.delete(key)
    }
  }, windowMs)
  sweep.unref()

  return function userQuota(req: Request, res: Response, next: NextFunction) {
    // requireAuth must run before this — without it there is no userId to key on
    // and every caller would share a single bucket.
    const key = req.userId
    if (!key) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const now = Date.now()
    const entry = usage.get(key)

    if (!entry || now > entry.resetAt) {
      usage.set(key, { count: 1, resetAt: now + windowMs })
      next()
      return
    }

    if (entry.count >= maxRequests) {
      const minutesLeft = Math.ceil((entry.resetAt - now) / 60_000)
      res.status(429).json({
        error: `Quota exceeded — ${maxRequests} ${label} per hour. Try again in ${minutesLeft} min.`,
      })
      return
    }

    entry.count += 1
    next()
  }
}

const HOUR = 60 * 60 * 1000

// Runs are the expensive path (one provider call per node, sometimes two for
// research nodes that search), so they get the tighter budget.
export const runQuota  = createUserQuota({ windowMs: HOUR, maxRequests: 20, label: 'workflow runs' })

// Planning is a single small gpt-4o-mini call and is cached by goal string,
// so it can afford a looser cap.
export const planQuota = createUserQuota({ windowMs: HOUR, maxRequests: 40, label: 'plan requests' })
