import { describe, it, expect } from 'vitest'
import { withStallTimeout, ProviderStallError } from './stream.js'

// Real timers with small budgets rather than fake timers: the interaction being
// tested is between a timer and an async iterator, and faking one side of that
// tends to test the mock rather than the code.
const FIRST = 80
const BETWEEN = 80

// Resolves after ms, or rejects if the signal aborts first — which is how a
// real provider stream behaves when we cancel it.
function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error('aborted'))
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new Error('aborted'))
    }, { once: true })
  })
}

// Builds a source that emits each value after its own delay, cancellable
// partway through — a stand-in for the OpenAI SDK's Stream.
async function* source(steps: Array<[number, string]>, signal: AbortSignal) {
  for (const [delay, value] of steps) {
    await abortableDelay(delay, signal)
    yield value
  }
}

// Wires a source to the guard the same way runNode does, and reports whether
// abort was actually called.
function harness(steps: Array<[number, string]>) {
  const controller = new AbortController()
  let aborted = false
  const guarded = withStallTimeout(source(steps, controller.signal), {
    firstChunkMs: FIRST,
    betweenChunksMs: BETWEEN,
    abort: () => { aborted = true; controller.abort() },
  })
  return { guarded, didAbort: () => aborted }
}

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = []
  for await (const value of it) out.push(value)
  return out
}

describe('withStallTimeout', () => {
  it('passes every chunk through when the source keeps up', async () => {
    const { guarded } = harness([[5, 'a'], [5, 'b'], [5, 'c']])
    expect(await collect(guarded)).toEqual(['a', 'b', 'c'])
  })

  it('completes cleanly on an empty source', async () => {
    const { guarded } = harness([])
    expect(await collect(guarded)).toEqual([])
  })

  it('does not abort a healthy stream', async () => {
    const { guarded, didAbort } = harness([[5, 'a'], [5, 'b']])
    await collect(guarded)
    expect(didAbort()).toBe(false)
  })

  it('throws ProviderStallError when the first chunk never arrives', async () => {
    const { guarded } = harness([[400, 'never']])
    await expect(collect(guarded)).rejects.toThrow(ProviderStallError)
  })

  it('tags a first-chunk stall with the right phase', async () => {
    const { guarded } = harness([[400, 'never']])
    await expect(collect(guarded)).rejects.toMatchObject({ phase: 'first-chunk' })
  })

  it('throws when the stream goes quiet mid-response', async () => {
    const { guarded } = harness([[5, 'a'], [5, 'b'], [400, 'never']])
    await expect(collect(guarded)).rejects.toMatchObject({ phase: 'mid-stream' })
  })

  it('aborts the underlying request on a stall, so the socket is released', async () => {
    const { guarded, didAbort } = harness([[400, 'never']])
    await collect(guarded).catch(() => {})
    expect(didAbort()).toBe(true)
  })

  it('yields the chunks that did arrive before the stall', async () => {
    const received: string[] = []
    const { guarded } = harness([[5, 'a'], [5, 'b'], [400, 'never']])
    try {
      for await (const value of guarded) received.push(value)
    } catch {
      // expected
    }
    expect(received).toEqual(['a', 'b'])
  })

  it('reports how long it waited, in seconds', async () => {
    const { guarded } = harness([[400, 'never']])
    await expect(collect(guarded)).rejects.toThrow(/no data for/)
  })

  // The timer is re-armed only after the consumer takes the chunk, so work we
  // do downstream (socket writes, database inserts) is never counted as a
  // provider stall. Without that, a slow consumer would abort a healthy stream.
  it('does not blame the provider for a slow consumer', async () => {
    const { guarded, didAbort } = harness([[5, 'a'], [5, 'b'], [5, 'c']])
    const received: string[] = []
    for await (const value of guarded) {
      received.push(value)
      await new Promise((r) => setTimeout(r, BETWEEN + 60)) // longer than the gap budget
    }
    expect(received).toEqual(['a', 'b', 'c'])
    expect(didAbort()).toBe(false)
  })

  it('propagates a genuine source error unchanged', async () => {
    async function* broken() {
      yield 'a'
      throw new Error('provider returned 500')
    }
    const guarded = withStallTimeout(broken(), {
      firstChunkMs: FIRST,
      betweenChunksMs: BETWEEN,
      abort: () => {},
    })
    await expect(collect(guarded)).rejects.toThrow('provider returned 500')
    await expect(collect(withStallTimeout(broken(), {
      firstChunkMs: FIRST,
      betweenChunksMs: BETWEEN,
      abort: () => {},
    }))).rejects.not.toBeInstanceOf(ProviderStallError)
  })
})

describe('ProviderStallError', () => {
  it('distinguishes the two phases in its message', () => {
    expect(new ProviderStallError(20_000, 'first-chunk').message).toContain('before sending anything')
    expect(new ProviderStallError(20_000, 'mid-stream').message).toContain('mid-response')
  })

  it('rounds the wait to whole seconds', () => {
    expect(new ProviderStallError(20_000, 'mid-stream').message).toContain('20s')
  })

  it('is an Error with a stable name', () => {
    const err = new ProviderStallError(1000, 'mid-stream')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('ProviderStallError')
  })
})
