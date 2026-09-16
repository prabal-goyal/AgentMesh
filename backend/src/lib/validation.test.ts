import { describe, it, expect } from 'vitest'
import { executeRequestSchema, planRequestSchema, formatIssues } from './validation.js'
import { ALLOWED_MODELS } from './executor.js'

// These schemas are the trust boundary: everything past them is treated as
// safe, so a regression here is a security regression, not a cosmetic one.

const node = (over: Record<string, unknown> = {}) => ({
  id: '1',
  label: 'Research',
  model: 'google/gemini-2.5-flash',
  systemPrompt: 'do the thing',
  nodeType: 'research',
  ...over,
})

// Pulls the message out of a failed parse so tests can assert on the reason
const reason = (body: unknown) => {
  const r = executeRequestSchema.safeParse(body)
  return r.success ? null : formatIssues(r.error)
}

describe('executeRequestSchema — model allowlist', () => {
  it('accepts every allowlisted model', () => {
    for (const model of ALLOWED_MODELS) {
      const r = executeRequestSchema.safeParse({ nodes: [node({ model })], edges: [] })
      expect(r.success, `expected ${model} to be accepted`).toBe(true)
    }
  })

  it('rejects a model that is not on the allowlist', () => {
    expect(reason({ nodes: [node({ model: 'anthropic/claude-opus-4-1' })], edges: [] }))
      .toContain('Unsupported model')
  })

  it('rejects an empty model on a normal node', () => {
    expect(reason({ nodes: [node({ model: '' })], edges: [] })).toContain('Unsupported model')
  })

  // Conditional nodes never reach a provider — the executor branches on
  // nodeType before resolveModel — so model:'' is legitimate for them only.
  it('allows an empty model on a conditional node', () => {
    const r = executeRequestSchema.safeParse({
      nodes: [node({ nodeType: 'conditional', model: '', condition: 'contains:yes' })],
      edges: [],
    })
    expect(r.success).toBe(true)
  })
})

describe('executeRequestSchema — graph integrity', () => {
  it('accepts a minimal valid graph', () => {
    expect(executeRequestSchema.safeParse({ nodes: [node()], edges: [], goal: 'hi' }).success).toBe(true)
  })

  it('defaults edges and goal when omitted', () => {
    const r = executeRequestSchema.safeParse({ nodes: [node()] })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.edges).toEqual([])
      expect(r.data.goal).toBe('')
    }
  })

  it('rejects an empty node list', () => {
    expect(reason({ nodes: [], edges: [] })).toContain('nodes')
  })

  it('rejects duplicate node ids', () => {
    expect(reason({ nodes: [node(), node()], edges: [] })).toContain('Duplicate node ids')
  })

  // topoWaves does nodeMap.get(childId)! — a dangling edge would push undefined
  // into a wave and crash mid-run, so the graph is rejected up front.
  it('rejects an edge whose target is not a node', () => {
    expect(reason({ nodes: [node()], edges: [{ source: '1', target: 'ghost' }] }))
      .toContain('Edge target')
  })

  it('rejects an edge whose source is not a node', () => {
    expect(reason({ nodes: [node()], edges: [{ source: 'ghost', target: '1' }] }))
      .toContain('Edge source')
  })

  // Cycle rejection happens here rather than at runtime, so a malformed graph
  // never opens an SSE stream, writes a run row, or reaches a provider.
  it('rejects a two-node cycle', () => {
    const nodes = [node(), node({ id: '2' })]
    const edges = [
      { source: '1', target: '2' },
      { source: '2', target: '1' },
    ]
    expect(reason({ nodes, edges })).toContain('cycle')
  })

  it('rejects a longer cycle', () => {
    const nodes = [node(), node({ id: '2' }), node({ id: '3' })]
    const edges = [
      { source: '1', target: '2' },
      { source: '2', target: '3' },
      { source: '3', target: '1' },
    ]
    expect(reason({ nodes, edges })).toContain('cycle')
  })

  it('names the cyclic nodes in the error message', () => {
    const nodes = [node(), node({ id: '2' }), node({ id: '3' })]
    const edges = [
      { source: '2', target: '3' },
      { source: '3', target: '2' },
    ]
    expect(reason({ nodes, edges })).toContain('2, 3')
  })

  it('rejects a self-loop', () => {
    expect(reason({ nodes: [node()], edges: [{ source: '1', target: '1' }] })).toContain('cycle')
  })

  it('still accepts an acyclic diamond', () => {
    const nodes = [node(), node({ id: '2' }), node({ id: '3' }), node({ id: '4' })]
    const edges = [
      { source: '1', target: '2' },
      { source: '1', target: '3' },
      { source: '2', target: '4' },
      { source: '3', target: '4' },
    ]
    expect(executeRequestSchema.safeParse({ nodes, edges }).success).toBe(true)
  })

  // A dangling edge would make the cycle check meaningless, so the more
  // actionable error wins rather than reporting both.
  it('reports the dangling edge, not a cycle, when both could apply', () => {
    const message = reason({ nodes: [node()], edges: [{ source: '1', target: 'ghost' }] })
    expect(message).toContain('Edge target')
    expect(message).not.toContain('cycle')
  })

  it('accepts a sourceHandle of yes or no', () => {
    const nodes = [node(), node({ id: '2' })]
    for (const sourceHandle of ['yes', 'no']) {
      const r = executeRequestSchema.safeParse({
        nodes,
        edges: [{ source: '1', target: '2', sourceHandle }],
      })
      expect(r.success).toBe(true)
    }
  })
})

describe('executeRequestSchema — abuse caps', () => {
  it('rejects more than 20 nodes', () => {
    const nodes = Array.from({ length: 21 }, (_, i) => node({ id: String(i) }))
    expect(reason({ nodes, edges: [] })).toContain('nodes')
  })

  it('accepts exactly 20 nodes', () => {
    const nodes = Array.from({ length: 20 }, (_, i) => node({ id: String(i) }))
    expect(executeRequestSchema.safeParse({ nodes, edges: [] }).success).toBe(true)
  })

  it('rejects an oversized system prompt', () => {
    expect(reason({ nodes: [node({ systemPrompt: 'x'.repeat(8001) })], edges: [] }))
      .toContain('systemPrompt')
  })

  // The single-node retry path packs whole parent outputs into goal, so this
  // limit is deliberately generous — but still bounded.
  it('accepts a long retry-style goal', () => {
    const r = executeRequestSchema.safeParse({ nodes: [node()], edges: [], goal: 'x'.repeat(12_000) })
    expect(r.success).toBe(true)
  })

  it('rejects a goal beyond the execute limit', () => {
    expect(reason({ nodes: [node()], edges: [], goal: 'x'.repeat(20_001) })).toContain('goal')
  })
})

describe('executeRequestSchema — output safety', () => {
  // zod strips unknown keys, so the executor only ever sees validated fields.
  it('strips unknown keys from the parsed result', () => {
    const r = executeRequestSchema.safeParse({
      nodes: [node({ evil: 'payload' })],
      edges: [],
      alsoEvil: true,
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.nodes[0]).not.toHaveProperty('evil')
      expect(r.data).not.toHaveProperty('alsoEvil')
    }
  })

  it('rejects a non-object body', () => {
    expect(executeRequestSchema.safeParse('not a graph').success).toBe(false)
    expect(executeRequestSchema.safeParse(null).success).toBe(false)
  })
})

describe('planRequestSchema', () => {
  it('accepts a normal goal', () => {
    expect(planRequestSchema.safeParse({ goal: 'write a blog post' }).success).toBe(true)
  })

  it('trims the goal', () => {
    const r = planRequestSchema.safeParse({ goal: '  spaced out  ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.goal).toBe('spaced out')
  })

  it('rejects a whitespace-only goal', () => {
    expect(planRequestSchema.safeParse({ goal: '   ' }).success).toBe(false)
  })

  it('rejects a missing goal', () => {
    expect(planRequestSchema.safeParse({}).success).toBe(false)
  })

  // Tighter than the execute limit: a planning goal is typed by a human.
  it('rejects a goal beyond the plan limit', () => {
    expect(planRequestSchema.safeParse({ goal: 'x'.repeat(2001) }).success).toBe(false)
  })
})

describe('formatIssues', () => {
  it('renders a field path and message on one line', () => {
    const r = planRequestSchema.safeParse({})
    expect(r.success).toBe(false)
    if (!r.success) expect(formatIssues(r.error)).toMatch(/^goal: /)
  })

  it('joins multiple issues with a semicolon', () => {
    const message = reason({ nodes: [node()], edges: [{ source: 'a', target: 'b' }] })
    expect(message).toContain(';')
  })
})
