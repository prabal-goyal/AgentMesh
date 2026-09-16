import OpenAI from 'openai'

// Both clients are built on first use rather than at module load. The OpenAI
// SDK throws when apiKey is undefined, so constructing them eagerly meant that
// *importing* anything downstream of this file — including the pure graph
// helpers in executor.ts — required real credentials. That made the executor
// untestable, and it also made the "OPENAI_API_KEY is not set" warning in
// index.ts unreachable: ESM evaluates imports before the module body, so the
// process crashed with an SDK error before the warning could print.
let openaiClient: OpenAI | null = null
let openrouterClient: OpenAI | null = null

// The SDK clears its request timer once fetch() resolves, and fetch() resolves
// on response *headers*. Measured against both providers, headers arrive
// essentially with the first token (gap: 2ms on OpenRouter, 23ms on OpenAI) —
// they hold the response open while the model thinks. So this timeout is in
// practice the time-to-first-token budget, not a connection timeout, and it
// must be generous enough for a slow model on a long prompt.
// Nothing here bounds the gaps *between* chunks once streaming starts; that is
// what withStallTimeout in lib/stream.ts is for.
const REQUEST_TIMEOUT_MS = 60_000

// Left at the SDK default of 2 deliberately. Its retry logic is better than a
// hand-rolled loop — 408/409/429/5xx only, exponential backoff with jitter, and
// it honours Retry-After — so wrapping it in our own loop would multiply
// attempts (3 x 3 = 9 calls per node), not improve reliability.
// Worst case is a genuinely hung provider: 3 attempts x 60s ≈ 3 minutes before
// the node fails. Bounded, where today it is unbounded.
const MAX_RETRIES = 2

const clientOptions = { timeout: REQUEST_TIMEOUT_MS, maxRetries: MAX_RETRIES }

// Direct OpenAI client — used when model starts with "openai/"
function getOpenAI(): OpenAI {
  openaiClient ??= new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    ...clientOptions,
  })
  return openaiClient
}

// OpenRouter client — used for all non-OpenAI models (Anthropic, Google, Meta, etc.)
function getOpenRouter(): OpenAI {
  openrouterClient ??= new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    ...clientOptions,
  })
  return openrouterClient
}

// Picks the right client and normalizes the model name.
// OpenAI models use "openai/gpt-4o" in our app but the OpenAI API expects just "gpt-4o".
// All other models go to OpenRouter with the full string unchanged.
export function resolveModel(model: string): { client: OpenAI; model: string } {
  if (model.startsWith('openai/')) {
    return { client: getOpenAI(), model: model.replace('openai/', '') }
  }
  return { client: getOpenRouter(), model }
}
