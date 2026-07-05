import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import planRouter from './routes/plan.js'
import executeRouter from './routes/execute.js'

// Fail fast — catch missing keys before any request is made
if (!process.env.OPENAI_API_KEY)     console.warn('⚠️  OPENAI_API_KEY is not set')
if (!process.env.OPENROUTER_API_KEY) console.warn('⚠️  OPENROUTER_API_KEY is not set')
if (!process.env.TAVILY_API_KEY)     console.warn('⚠️  TAVILY_API_KEY is not set — web search disabled')

const app = express()
const PORT = process.env.PORT || 3001

// Allow any localhost port — Vite picks a different port if 5173 is in use
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin.startsWith('http://localhost:')) {
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

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})
