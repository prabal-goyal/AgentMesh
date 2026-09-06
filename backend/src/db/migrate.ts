import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import 'dotenv/config'
import { pool } from './pool.js'

// __dirname doesn't exist in native ESM — rebuild it from import.meta.url
const __dirname = dirname(fileURLToPath(import.meta.url))
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8')

async function migrate() {
  await pool.query(schema)
  console.log('Migration applied: users table ready')
  await pool.end()
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
