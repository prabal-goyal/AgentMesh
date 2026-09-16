import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolveModel } from './openrouter.js'

// This file is only testable because the clients are built lazily. Stubbing the
// keys here rather than at import time is the whole point — an eager
// `new OpenAI()` at module load would have thrown before this line ran.
describe('resolveModel', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key-unused')
    vi.stubEnv('OPENROUTER_API_KEY', 'test-key-unused')
  })
  afterEach(() => { vi.unstubAllEnvs() })

  it('strips the openai/ prefix, because the OpenAI API wants a bare model name', () => {
    expect(resolveModel('openai/gpt-4o').model).toBe('gpt-4o')
    expect(resolveModel('openai/gpt-4o-mini').model).toBe('gpt-4o-mini')
  })

  it('sends openai/ models to the direct OpenAI client', () => {
    expect(resolveModel('openai/gpt-4o').client.baseURL).toContain('api.openai.com')
  })

  it('passes non-OpenAI model names through unchanged', () => {
    expect(resolveModel('anthropic/claude-haiku-4-5').model).toBe('anthropic/claude-haiku-4-5')
    expect(resolveModel('google/gemini-2.5-flash').model).toBe('google/gemini-2.5-flash')
  })

  it('routes everything else through OpenRouter', () => {
    expect(resolveModel('anthropic/claude-sonnet-4-6').client.baseURL).toContain('openrouter.ai')
    expect(resolveModel('google/gemini-2.5-flash').client.baseURL).toContain('openrouter.ai')
  })

  it('reuses the same client instance across calls', () => {
    expect(resolveModel('openai/gpt-4o').client).toBe(resolveModel('openai/gpt-4o-mini').client)
  })

  it('only matches the prefix at the start of the name', () => {
    // a model merely containing "openai/" must not be rewritten
    expect(resolveModel('someprovider/openai/thing').model).toBe('someprovider/openai/thing')
  })
})
