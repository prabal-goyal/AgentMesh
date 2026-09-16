// Thrown when a provider opens a stream and then stops sending data. Typed so
// callers can tell a hung stream apart from a provider error or a bad request.
export class ProviderStallError extends Error {
  constructor(
    public readonly waitedMs: number,
    public readonly phase: 'first-chunk' | 'mid-stream'
  ) {
    const where = phase === 'first-chunk' ? 'before sending anything' : 'mid-response'
    super(`Provider stalled ${where} — no data for ${Math.round(waitedMs / 1000)}s`)
    this.name = 'ProviderStallError'
  }
}

export interface StallTimeoutOptions {
  // Budget for the first chunk. Mostly a backstop: both our providers hold
  // response headers until generation starts, so the SDK's own request timeout
  // usually fires first. It matters for a provider that sends headers early.
  firstChunkMs: number
  // Budget for the gap between chunks. Once tokens are flowing they arrive
  // milliseconds apart, so a long silence here means the stream is hung.
  // Nothing in the OpenAI SDK covers this window.
  betweenChunksMs: number
  // Cancels the underlying request. Without this the socket stays open even
  // after we stop reading, and the provider keeps billing a response nobody
  // is listening to.
  abort: () => void
}

/**
 * Wraps a provider stream so a silent gap between chunks cannot hang forever.
 *
 * The timer is cleared when a chunk arrives and re-armed only after the
 * consumer has finished with it, so slow downstream work (writing to a socket,
 * a database insert) is never mistaken for a stalled provider.
 */
export async function* withStallTimeout<T>(
  source: AsyncIterable<T>,
  { firstChunkMs, betweenChunksMs, abort }: StallTimeoutOptions
): AsyncGenerator<T> {
  let stalled: ProviderStallError | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  const arm = (ms: number, phase: 'first-chunk' | 'mid-stream') => {
    timer = setTimeout(() => {
      stalled = new ProviderStallError(ms, phase)
      // Aborting makes the for-await below reject, which we convert into the
      // typed error in the catch. Some sources end cleanly instead, so the
      // post-loop check covers that case too.
      abort()
    }, ms)
  }

  arm(firstChunkMs, 'first-chunk')

  try {
    for await (const chunk of source) {
      clearTimeout(timer)
      yield chunk
      arm(betweenChunksMs, 'mid-stream')
    }
    if (stalled) throw stalled
  } catch (err) {
    // An abort we caused surfaces as whatever the source throws (the OpenAI SDK
    // raises APIUserAbortError); report the real reason instead.
    if (stalled) throw stalled
    throw err
  } finally {
    clearTimeout(timer)
  }
}
