import { describe, it, expect, afterEach } from 'vitest'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import OpenAI from 'openai'
import { withStallTimeout, ProviderStallError } from './stream.js'

// stream.test.ts drives withStallTimeout with a hand-written async generator,
// which can only prove the guard behaves against a source that *mimics* the
// SDK. This file runs it against the real OpenAI SDK reading a real socket, to
// prove the assumption the whole design rests on: that aborting mid-stream
// makes the for-await reject rather than hang or end silently.
//
// Everything is localhost — no API key, no network, safe in CI.

let server: http.Server | null = null

afterEach(async () => {
  if (server) {
    // close() alone waits for open connections to finish, and these fakes
    // deliberately never finish — force the sockets shut first.
    server.closeAllConnections()
    await new Promise<void>((r) => server!.close(() => r()))
  }
  server = null
})

// A provider that opens an SSE stream, sends `tokens`, then goes quiet forever.
// Resolves with the base URL and a way to check the socket was released.
async function startHangingProvider(tokens: string[]) {
  let clientDisconnected = false

  server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' })
    // Node buffers headers until the first write. Flushing makes this fake
    // behave like a provider that opens the response eagerly — which is the
    // only case firstChunkMs can defend. If headers are withheld too, the
    // SDK's own request timeout is what applies, because create() has not
    // resolved yet and the guard is not wrapping anything.
    res.flushHeaders()
    for (const token of tokens) {
      res.write(`data: ${JSON.stringify({
        id: 'x', object: 'chat.completion.chunk', created: 0, model: 'fake',
        choices: [{ index: 0, delta: { content: token }, finish_reason: null }],
      })}\n\n`)
    }
    // No end(), no [DONE], no further chunks — the hang we are defending against.
    req.on('close', () => { clientDisconnected = true })
  })

  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r))
  const { port } = server!.address() as AddressInfo

  return { baseURL: `http://127.0.0.1:${port}`, wasDisconnected: () => clientDisconnected }
}

async function readGuarded(baseURL: string, betweenChunksMs: number) {
  // maxRetries: 0 — a retry here would just hang again and slow the test.
  const client = new OpenAI({ baseURL, apiKey: 'not-used-by-the-fake', maxRetries: 0 })
  const controller = new AbortController()

  const stream = await client.chat.completions.create({
    model: 'fake',
    stream: true,
    messages: [{ role: 'user', content: 'hi' }],
  }, { signal: controller.signal })

  const received: string[] = []
  const startedAt = Date.now()

  try {
    for await (const chunk of withStallTimeout(stream, {
      firstChunkMs: 5_000,
      betweenChunksMs,
      abort: () => controller.abort(),
    })) {
      const token = chunk.choices?.[0]?.delta?.content
      if (token) received.push(token)
    }
    return { received, error: null as unknown, elapsed: Date.now() - startedAt }
  } catch (error) {
    return { received, error, elapsed: Date.now() - startedAt }
  }
}

describe('withStallTimeout against a real SDK stream', () => {
  it('converts a mid-stream hang into ProviderStallError', async () => {
    const provider = await startHangingProvider(['Hello'])
    const { error } = await readGuarded(provider.baseURL, 300)

    expect(error).toBeInstanceOf(ProviderStallError)
    expect(error).toMatchObject({ phase: 'mid-stream' })
  })

  it('keeps the tokens that arrived before the hang', async () => {
    const provider = await startHangingProvider(['Hel', 'lo'])
    const { received } = await readGuarded(provider.baseURL, 300)

    expect(received.join('')).toBe('Hello')
  })

  it('gives up close to the budget rather than hanging', async () => {
    const provider = await startHangingProvider(['Hello'])
    const { elapsed } = await readGuarded(provider.baseURL, 300)

    expect(elapsed).toBeGreaterThanOrEqual(250)
    expect(elapsed).toBeLessThan(3_000)
  })

  // The point of aborting rather than just walking away: an abandoned socket
  // leaves the provider streaming a response nobody reads, and billing for it.
  it('releases the socket so the provider stops generating', async () => {
    const provider = await startHangingProvider(['Hello'])
    await readGuarded(provider.baseURL, 300)

    await new Promise((r) => setTimeout(r, 200)) // let the close event land
    expect(provider.wasDisconnected()).toBe(true)
  })

  it('detects a hang that happens before any token arrives', async () => {
    const provider = await startHangingProvider([])
    const client = new OpenAI({ baseURL: provider.baseURL, apiKey: 'x', maxRetries: 0 })
    const controller = new AbortController()

    const stream = await client.chat.completions.create({
      model: 'fake', stream: true, messages: [{ role: 'user', content: 'hi' }],
    }, { signal: controller.signal })

    const guarded = withStallTimeout(stream, {
      firstChunkMs: 300,
      betweenChunksMs: 5_000,
      abort: () => controller.abort(),
    })

    await expect((async () => { for await (const _ of guarded) { /* drain */ } })())
      .rejects.toMatchObject({ phase: 'first-chunk' })
  })
})
