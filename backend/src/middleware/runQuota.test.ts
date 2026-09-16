import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { createUserQuota } from './runQuota.js'

// Express middleware is awkward to test only because of its req/res/next
// shape. Underneath, this one is a pure counter — so we hand it the smallest
// fakes that satisfy the parts it actually touches.

interface FakeRes {
  statusCode: number | null
  body: unknown
  status: (code: number) => FakeRes
  json: (payload: unknown) => FakeRes
}

function fakeRes(): FakeRes {
  const res: FakeRes = {
    statusCode: null,
    body: null,
    status(code) { res.statusCode = code; return res },
    json(payload) { res.body = payload; return res },
  }
  return res
}

const asReq = (userId?: string) => ({ userId }) as unknown as Request
const asRes = (res: FakeRes) => res as unknown as Response

// Drives the middleware once and reports whether it passed the request through
function call(mw: ReturnType<typeof createUserQuota>, userId?: string) {
  const res = fakeRes()
  let passed = false
  const next: NextFunction = () => { passed = true }
  mw(asReq(userId), asRes(res), next)
  return { passed, status: res.statusCode, body: res.body as { error?: string } | null }
}

const HOUR = 60 * 60 * 1000
const newQuota = (maxRequests = 3) =>
  createUserQuota({ windowMs: HOUR, maxRequests, label: 'test runs' })

describe('createUserQuota', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('lets requests through while under the limit', () => {
    const quota = newQuota(3)
    for (let i = 0; i < 3; i++) {
      expect(call(quota, 'user-a').passed, `request ${i + 1} should pass`).toBe(true)
    }
  })

  it('rejects with 429 once the limit is reached', () => {
    const quota = newQuota(3)
    for (let i = 0; i < 3; i++) call(quota, 'user-a')

    const fourth = call(quota, 'user-a')
    expect(fourth.passed).toBe(false)
    expect(fourth.status).toBe(429)
    expect(fourth.body?.error).toContain('Quota exceeded')
  })

  it('names the limit and the label in the error', () => {
    const quota = newQuota(1)
    call(quota, 'user-a')
    expect(call(quota, 'user-a').body?.error).toContain('1 test runs per hour')
  })

  // The whole reason this is keyed on userId rather than IP: one account
  // rotating IPs defeats a per-IP limit, but not this.
  it('counts each user separately', () => {
    const quota = newQuota(2)
    call(quota, 'user-a')
    call(quota, 'user-a')

    expect(call(quota, 'user-a').passed).toBe(false)
    expect(call(quota, 'user-b').passed).toBe(true)
  })

  it('keeps separate budgets for separate quota instances', () => {
    const runs = newQuota(1)
    const plans = newQuota(1)
    call(runs, 'user-a')

    expect(call(runs, 'user-a').passed).toBe(false)
    expect(call(plans, 'user-a').passed).toBe(true)
  })

  it('refills after the window elapses', () => {
    const quota = newQuota(2)
    call(quota, 'user-a')
    call(quota, 'user-a')
    expect(call(quota, 'user-a').passed).toBe(false)

    vi.advanceTimersByTime(HOUR + 1)
    expect(call(quota, 'user-a').passed).toBe(true)
  })

  it('does not refill early', () => {
    const quota = newQuota(1)
    call(quota, 'user-a')

    vi.advanceTimersByTime(HOUR - 1000)
    expect(call(quota, 'user-a').passed).toBe(false)
  })

  it('reports the minutes remaining until the window resets', () => {
    const quota = newQuota(1)
    call(quota, 'user-a')

    vi.advanceTimersByTime(30 * 60 * 1000)
    expect(call(quota, 'user-a').body?.error).toContain('30 min')
  })

  // requireAuth must run first. If it somehow didn't, every caller would share
  // one bucket — failing closed with a 401 is the safe response.
  it('rejects with 401 when no userId was attached', () => {
    const quota = newQuota(3)
    const result = call(quota, undefined)

    expect(result.passed).toBe(false)
    expect(result.status).toBe(401)
  })
})
