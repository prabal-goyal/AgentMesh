import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { authRateLimit } from '../middleware/rateLimit.js'

const router = Router()

const TOKEN_EXPIRY = '7d'

// Deliberately loose — just checks the "something@something.something"
// shape, not full RFC 5322. Good enough to keep obvious typos and garbage
// out of the users table without rejecting real addresses it doesn't expect.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function issueToken(userId: string) {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: TOKEN_EXPIRY })
}

router.post('/signup', authRateLimit, async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string }

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' })
    return
  }
  if (!EMAIL_SHAPE.test(email)) {
    res.status(400).json({ error: 'enter a valid email address' })
    return
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'password must be at least 8 characters' })
    return
  }

  const normalizedEmail = email.trim().toLowerCase()
  const passwordHash = await bcrypt.hash(password, 10)

  try {
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [normalizedEmail, passwordHash]
    )
    const user = result.rows[0]
    res.status(201).json({ token: issueToken(user.id), user })
  } catch (err) {
    // Postgres unique_violation — the DB constraint is the real guard against
    // a signup race, not an app-level "does this exist?" check beforehand
    if ((err as { code?: string }).code === '23505') {
      res.status(409).json({ error: 'Email already registered' })
      return
    }
    throw err
  }
})

router.post('/login', authRateLimit, async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string }

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' })
    return
  }

  const normalizedEmail = email.trim().toLowerCase()
  const result = await pool.query(
    'SELECT id, email, password_hash FROM users WHERE email = $1',
    [normalizedEmail]
  )
  const user = result.rows[0]

  // Same generic error whether the email doesn't exist or the password is
  // wrong — a different message per case would let someone enumerate which
  // emails have accounts here.
  const valid = user && (await bcrypt.compare(password, user.password_hash))
  if (!valid) {
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }

  res.json({ token: issueToken(user.id), user: { id: user.id, email: user.email } })
})

router.get('/me', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT id, email FROM users WHERE id = $1', [req.userId])
  const user = result.rows[0]

  if (!user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  res.json({ user })
})

export default router
