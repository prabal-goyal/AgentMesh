import type { Request, Response, NextFunction } from 'express'

// Per-IP sliding window, kept in memory. Good enough for a single backend
// instance — if AgentMesh ever runs multiple instances behind a load
// balancer, each instance would count separately and this stops being
// accurate; a shared store (e.g. Redis) would be needed then.
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const MAX_ATTEMPTS = 10

const attempts = new Map<string, { count: number; resetAt: number }>()

// Sweep expired entries periodically so the map doesn't grow forever on a
// long-running process — without this, every IP that ever hits the route
// stays in memory permanently.
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of attempts) {
    if (now > entry.resetAt) attempts.delete(key)
  }
}, WINDOW_MS)

// Guards signup/login from brute-force and signup-spam. Not applied to
// requireAuth-protected routes — those already need a valid token, which is
// a much higher bar than an IP address.
export function authRateLimit(req: Request, res: Response, next: NextFunction) {
  const key = req.ip ?? 'unknown'
  const now = Date.now()
  const entry = attempts.get(key)

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    next()
    return
  }

  if (entry.count >= MAX_ATTEMPTS) {
    res.status(429).json({ error: 'Too many attempts — try again later' })
    return
  }

  entry.count += 1
  next()
}
