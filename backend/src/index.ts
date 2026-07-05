import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import planRouter from './routes/plan.js'

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

// All requests to /api/plan are handled by planRouter
app.use('/api/plan', planRouter)

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})
