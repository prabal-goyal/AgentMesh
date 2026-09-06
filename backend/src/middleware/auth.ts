import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

// Declaration merging — extends Express's own Request type with our field,
// so req.userId is recognized by TypeScript everywhere, no casting needed.
declare global {
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

// Protects a route: verifies the Bearer token and attaches the userId it
// carries. Anything that fails verification (missing, expired, tampered,
// wrong secret) is treated the same — a 401, no distinction given to the caller.
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
    req.userId = payload.userId
    next()
  } catch {
    res.status(401).json({ error: 'Unauthorized' })
  }
}
