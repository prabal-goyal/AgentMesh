import OpenAI from 'openai'

// The OpenAI SDK works with OpenRouter because they use the same API shape.
// We just change the baseURL to point at OpenRouter instead of OpenAI.
// process.env reads from the .env file via the 'dotenv/config' import in index.ts
export const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
})
