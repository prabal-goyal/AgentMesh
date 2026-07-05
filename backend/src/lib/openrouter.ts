import OpenAI from 'openai'

// Direct OpenAI client — used when model starts with "openai/"
export const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// OpenRouter client — used for all non-OpenAI models (Anthropic, Google, Meta, etc.)
export const openrouterClient = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
})

// Picks the right client and normalizes the model name.
// OpenAI models use "openai/gpt-4o" in our app but the OpenAI API expects just "gpt-4o".
// All other models go to OpenRouter with the full string unchanged.
export function resolveModel(model: string): { client: OpenAI; model: string } {
  if (model.startsWith('openai/')) {
    return { client: openaiClient, model: model.replace('openai/', '') }
  }
  return { client: openrouterClient, model }
}
