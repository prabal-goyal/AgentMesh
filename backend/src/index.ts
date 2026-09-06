import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import planRouter from './routes/plan.js'
import executeRouter from './routes/execute.js'
import authRouter from './routes/auth.js'
import workflowsRouter from './routes/workflows.js'

// Fail fast — catch missing keys before any request is made
if (!process.env.OPENAI_API_KEY)     console.warn('⚠️  OPENAI_API_KEY is not set')
if (!process.env.OPENROUTER_API_KEY) console.warn('⚠️  OPENROUTER_API_KEY is not set')
if (!process.env.TAVILY_API_KEY)     console.warn('⚠️  TAVILY_API_KEY is not set — web search disabled')
if (!process.env.DATABASE_URL)       console.warn('⚠️  DATABASE_URL is not set — auth/storage disabled')

// Unlike the warnings above, this one can't just be a warning: every request
// to a protected route calls jwt.sign()/jwt.verify() with this secret, so a
// missing value doesn't "disable" auth — it crashes the first request instead.
// Fail at boot instead, where the problem is obvious.
if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET is not set — cannot start with auth routes enabled')
  process.exit(1)
}

const app = express()
const PORT = process.env.PORT || 3001

// Render puts the app behind a proxy — without this, req.ip is the proxy's
// address for every request, which would make the auth rate limiter treat
// all users as a single caller instead of limiting per-IP.
app.set('trust proxy', 1)

const ALLOWED_ORIGINS = [
  'https://agent-mesh-frontend-six.vercel.app',
]

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin.startsWith('http://localhost:') || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  }
}))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/plan', planRouter)
app.use('/api/execute', executeRouter)
app.use('/api/auth', authRouter)
app.use('/api/workflows', workflowsRouter)

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})
