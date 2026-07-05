import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import planRouter from './routes/plan.js'

const app = express()
const PORT = process.env.PORT || 3001

// cors lets the frontend (port 5173) talk to this backend (port 3001)
// without this, the browser blocks cross-origin requests
app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// All requests to /api/plan are handled by planRouter
app.use('/api/plan', planRouter)

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})
