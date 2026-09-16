import { describe, it, expect, vi } from 'vitest'
import {
  topoWaves,
  getParentIds,
  evaluateCondition,
  shouldSkip,
  calcCost,
  buildUserMessage,
  runTool,
  ALLOWED_MODELS,
  CyclicGraphError,
  type NodeInput,
  type EdgeInput,
} from './executor.js'

// These helpers are pure — no network, no clock, no database — so every test
// here runs in microseconds with no mocking. That is the whole reason this
// file is worth more per hour than any other test we could write.

const node = (id: string, over: Partial<NodeInput> = {}): NodeInput => ({
  id,
  label: `Node ${id}`,
  model: 'openai/gpt-4o-mini',
  systemPrompt: '',
  ...over,
})

// Compare wave structure by id, which is what actually matters for scheduling
const ids = (waves: NodeInput[][]) => waves.map((w) => w.map((n) => n.id))

describe('topoWaves', () => {
  it('returns no waves for an empty graph', () => {
    expect(topoWaves([], [])).toEqual([])
  })

  it('puts a single node in one wave', () => {
    expect(ids(topoWaves([node('1')], []))).toEqual([['1']])
  })

  it('orders a linear chain into one node per wave', () => {
    const nodes = [node('1'), node('2'), node('3')]
    const edges: EdgeInput[] = [
      { source: '1', target: '2' },
      { source: '2', target: '3' },
    ]
    expect(ids(topoWaves(nodes, edges))).toEqual([['1'], ['2'], ['3']])
  })

  it('groups independent nodes into the same wave so they can run in parallel', () => {
    const nodes = [node('1'), node('2'), node('3')]
    expect(ids(topoWaves(nodes, []))).toEqual([['1', '2', '3']])
  })

  it('splits a fan-out into parent wave then children wave', () => {
    const nodes = [node('1'), node('2'), node('3')]
    const edges: EdgeInput[] = [
      { source: '1', target: '2' },
      { source: '1', target: '3' },
    ]
    expect(ids(topoWaves(nodes, edges))).toEqual([['1'], ['2', '3']])
  })

  it('holds a join node until every parent has completed', () => {
    // diamond: 1 → 2, 1 → 3, 2 → 4, 3 → 4
    const nodes = [node('1'), node('2'), node('3'), node('4')]
    const edges: EdgeInput[] = [
      { source: '1', target: '2' },
      { source: '1', target: '3' },
      { source: '2', target: '4' },
      { source: '3', target: '4' },
    ]
    // 4 must be in its own final wave, never alongside 2 or 3
    expect(ids(topoWaves(nodes, edges))).toEqual([['1'], ['2', '3'], ['4']])
  })

  it('schedules two disconnected subgraphs side by side', () => {
    const nodes = [node('1'), node('2'), node('3'), node('4')]
    const edges: EdgeInput[] = [
      { source: '1', target: '2' },
      { source: '3', target: '4' },
    ]
    expect(ids(topoWaves(nodes, edges))).toEqual([['1', '3'], ['2', '4']])
  })

  // ── Cycle rejection (backlog item 4, now fixed) ───────────────────────────
  // These replaced characterization tests that pinned the old silent-drop bug.
  it('throws on a two-node cycle instead of dropping it', () => {
    const nodes = [node('1'), node('2')]
    const edges: EdgeInput[] = [
      { source: '1', target: '2' },
      { source: '2', target: '1' },
    ]
    expect(() => topoWaves(nodes, edges)).toThrow(CyclicGraphError)
  })

  it('throws when only part of the graph is cyclic', () => {
    const nodes = [node('1'), node('2'), node('3')]
    const edges: EdgeInput[] = [
      { source: '2', target: '3' },
      { source: '3', target: '2' },
    ]
    expect(() => topoWaves(nodes, edges)).toThrow(CyclicGraphError)
  })

  it('names exactly the nodes trapped in the cycle', () => {
    const nodes = [node('1'), node('2'), node('3')]
    const edges: EdgeInput[] = [
      { source: '2', target: '3' },
      { source: '3', target: '2' },
    ]
    try {
      topoWaves(nodes, edges)
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(CyclicGraphError)
      // node 1 is acyclic and must not be blamed
      expect((err as CyclicGraphError).nodeIds).toEqual(['2', '3'])
    }
  })

  it('detects a longer cycle, not just a mutual pair', () => {
    const nodes = [node('1'), node('2'), node('3')]
    const edges: EdgeInput[] = [
      { source: '1', target: '2' },
      { source: '2', target: '3' },
      { source: '3', target: '1' },
    ]
    expect(() => topoWaves(nodes, edges)).toThrow(CyclicGraphError)
  })

  it('treats a self-loop as a cycle', () => {
    expect(() => topoWaves([node('1')], [{ source: '1', target: '1' }])).toThrow(CyclicGraphError)
  })

  it('words a self-loop in the singular', () => {
    expect(() => topoWaves([node('1')], [{ source: '1', target: '1' }]))
      .toThrow('node 1 depends on itself')
  })

  it('explains the failure in the message', () => {
    const nodes = [node('1'), node('2')]
    const edges: EdgeInput[] = [
      { source: '1', target: '2' },
      { source: '2', target: '1' },
    ]
    expect(() => topoWaves(nodes, edges)).toThrow(/cycle/i)
  })

  it('does not throw on a diamond, which is acyclic despite the join', () => {
    const nodes = [node('1'), node('2'), node('3'), node('4')]
    const edges: EdgeInput[] = [
      { source: '1', target: '2' },
      { source: '1', target: '3' },
      { source: '2', target: '4' },
      { source: '3', target: '4' },
    ]
    expect(() => topoWaves(nodes, edges)).not.toThrow()
  })
})

describe('getParentIds', () => {
  const edges: EdgeInput[] = [
    { source: '1', target: '3' },
    { source: '2', target: '3' },
    { source: '3', target: '4' },
  ]

  it('returns an empty list for a root node', () => {
    expect(getParentIds('1', edges)).toEqual([])
  })

  it('returns the single parent of a chained node', () => {
    expect(getParentIds('4', edges)).toEqual(['3'])
  })

  it('returns every parent of a join node', () => {
    expect(getParentIds('3', edges)).toEqual(['1', '2'])
  })
})

describe('evaluateCondition', () => {
  it('matches a contains: keyword', () => {
    expect(evaluateCondition('contains:approved', 'The draft is approved')).toBe(true)
  })

  it('fails a contains: keyword that is absent', () => {
    expect(evaluateCondition('contains:approved', 'The draft needs work')).toBe(false)
  })

  it('ignores case on both sides', () => {
    expect(evaluateCondition('contains:APPROVED', 'the draft is approved')).toBe(true)
  })

  it('trims whitespace around the keyword', () => {
    expect(evaluateCondition('contains:  approved  ', 'it is approved')).toBe(true)
  })

  it('inverts the match for not-contains:', () => {
    expect(evaluateCondition('not-contains:rejected', 'all good')).toBe(true)
    expect(evaluateCondition('not-contains:rejected', 'it was rejected')).toBe(false)
  })

  // Both of these default to the YES branch, which is what makes a router with
  // a mistyped condition silently always-true rather than an error.
  it('defaults to true on an empty condition', () => {
    expect(evaluateCondition('', 'anything')).toBe(true)
  })

  it('defaults to true on an unrecognised condition prefix', () => {
    expect(evaluateCondition('startswith:yes', 'no')).toBe(true)
  })
})

describe('shouldSkip', () => {
  const edges: EdgeInput[] = [
    { source: '1', target: '3' },
    { source: '2', target: '3' },
  ]

  it('skips a node that was explicitly pruned', () => {
    expect(shouldSkip('3', edges, new Set(['3']))).toBe(true)
  })

  it('does not skip a node with no parents', () => {
    expect(shouldSkip('1', edges, new Set())).toBe(false)
  })

  it('cascades the skip when every parent was skipped', () => {
    expect(shouldSkip('3', edges, new Set(['1', '2']))).toBe(true)
  })

  it('cascades down a chain', () => {
    const chain: EdgeInput[] = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
    ]
    const skipped = new Set(['a'])
    expect(shouldSkip('b', chain, skipped)).toBe(true)
    skipped.add('b')
    expect(shouldSkip('c', chain, skipped)).toBe(true)
  })

  // ── Intentional semantics (backlog item 6, decided) ───────────────────────
  // "All parents" rather than "any parent" is what makes branching work. These
  // replaced a characterization test that pinned this as an open question.
  it('runs a join node when only some parents were skipped', () => {
    expect(shouldSkip('3', edges, new Set(['1']))).toBe(false)
  })

  it('keeps a Router join alive on the branch that was taken', () => {
    // Router(r) →yes A, Router(r) →no B, A → C, B → C. Taking yes prunes B.
    const routerEdges: EdgeInput[] = [
      { source: 'r', target: 'a', sourceHandle: 'yes' },
      { source: 'r', target: 'b', sourceHandle: 'no' },
      { source: 'a', target: 'c' },
      { source: 'b', target: 'c' },
    ]
    const skipped = new Set(['b'])

    expect(shouldSkip('a', routerEdges, skipped)).toBe(false)
    expect(shouldSkip('c', routerEdges, skipped)).toBe(false) // the join still runs
  })

  it('prunes the join only when every branch was skipped', () => {
    const routerEdges: EdgeInput[] = [
      { source: 'a', target: 'c' },
      { source: 'b', target: 'c' },
    ]
    expect(shouldSkip('c', routerEdges, new Set(['a', 'b']))).toBe(true)
  })
})

describe('runTool', () => {
  // Only the branches that short-circuit before touching the network. The
  // search path and the multi-round loop around it are covered end to end, not
  // here — see the tool-loop note in CLAUDE.md item 9.
  it('reports an unknown tool rather than throwing', async () => {
    const result = await runTool({ id: '1', name: 'delete_everything', arguments: '{}' })
    expect(result).toContain('Unknown tool')
    expect(result).toContain('delete_everything')
  })

  it('reports malformed arguments rather than throwing', async () => {
    const result = await runTool({ id: '1', name: 'search_web', arguments: '{"query": ' })
    expect(result).toContain('malformed')
  })

  it('treats empty arguments as malformed', async () => {
    expect(await runTool({ id: '1', name: 'search_web', arguments: '' })).toContain('malformed')
  })

  // Both failures return text rather than throwing on purpose: the string
  // becomes the tool result the model reads, so it can recover on the next
  // round instead of failing the whole node.
  it('never throws, so the model can recover on the next round', async () => {
    await expect(runTool({ id: '1', name: 'nope', arguments: 'not json' })).resolves.toBeTypeOf('string')
  })
})

describe('buildUserMessage', () => {
  const nodes = [node('1', { label: 'Research' }), node('2', { label: 'Rejected Path' }), node('3', { label: 'Summary' })]
  const edges: EdgeInput[] = [
    { source: '1', target: '3' },
    { source: '2', target: '3' },
  ]

  it('uses the goal for a node with no parents', () => {
    const message = buildUserMessage(nodes[0], nodes, [], {}, 'Write a report')
    expect(message).toContain('Write a report')
    expect(message).not.toContain('previous step')
  })

  it('includes each contributing parent under its label', () => {
    const outputs = { '1': 'findings here', '2': 'draft here' }
    const message = buildUserMessage(nodes[2], nodes, edges, outputs, 'g')

    expect(message).toContain('[Research]:\nfindings here')
    expect(message).toContain('[Rejected Path]:\ndraft here')
  })

  // The item 6 fix: a pruned or errored parent leaves no outputs entry, and
  // emitting "[Label]:" with nothing under it wastes tokens and invites the
  // model to invent the missing content.
  it('omits a parent that was pruned', () => {
    const outputs = { '1': 'findings here' } // node 2 pruned by a router
    const message = buildUserMessage(nodes[2], nodes, edges, outputs, 'g')

    expect(message).toContain('findings here')
    expect(message).not.toContain('Rejected Path')
  })

  it('leaves no empty stanza behind when a parent is omitted', () => {
    const outputs = { '1': 'findings here' }
    const message = buildUserMessage(nodes[2], nodes, edges, outputs, 'g')

    expect(message).not.toContain('---') // separator only appears between real blocks
    // a label immediately followed by a blank line is the empty-stanza bug
    expect(message).not.toMatch(/\]:\n\s*\n/)
  })

  it('treats a whitespace-only parent output as no contribution', () => {
    const outputs = { '1': 'findings here', '2': '   \n  ' }
    const message = buildUserMessage(nodes[2], nodes, edges, outputs, 'g')

    expect(message).not.toContain('Rejected Path')
  })

  it('falls back to the goal when every parent contributed nothing', () => {
    const message = buildUserMessage(nodes[2], nodes, edges, {}, 'Write a report')

    expect(message).toContain('Write a report')
    expect(message).not.toContain('previous step')
  })

  it('truncates a very long parent output', () => {
    const outputs = { '1': 'x'.repeat(2500) }
    const message = buildUserMessage(nodes[2], nodes, [{ source: '1', target: '3' }], outputs, 'g')

    expect(message).toContain('[truncated]')
    expect(message.length).toBeLessThan(2500 + 300)
  })

  it('falls back to the node id when a parent has no matching node', () => {
    const outputs = { 'ghost': 'orphan output' }
    const message = buildUserMessage(nodes[2], nodes, [{ source: 'ghost', target: '3' }], outputs, 'g')

    expect(message).toContain('[ghost]:')
  })

  it('warns when a parent contributed nothing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    buildUserMessage(nodes[2], nodes, edges, { '1': 'findings here' }, 'g')

    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0][0]).toContain('Rejected Path')
    warn.mockRestore()
  })

  it('does not warn when every parent contributed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    buildUserMessage(nodes[2], nodes, edges, { '1': 'a', '2': 'b' }, 'g')

    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('calcCost', () => {
  it('prices input and output at their separate rates', () => {
    // gpt-4o: $2.50/M input, $10.00/M output
    expect(calcCost('openai/gpt-4o', 1_000_000, 0)).toBeCloseTo(2.5, 10)
    expect(calcCost('openai/gpt-4o', 0, 1_000_000)).toBeCloseTo(10, 10)
  })

  it('sums both sides', () => {
    expect(calcCost('openai/gpt-4o', 1_000_000, 1_000_000)).toBeCloseTo(12.5, 10)
  })

  it('costs nothing for zero tokens', () => {
    expect(calcCost('openai/gpt-4o', 0, 0)).toBe(0)
  })

  it('prices every allowlisted model above zero', () => {
    for (const model of ALLOWED_MODELS) {
      expect(calcCost(model, 1_000_000, 1_000_000)).toBeGreaterThan(0)
    }
  })

  // This fallback is why the allowlist exists: an unpriced model would run and
  // be billed to us while reporting $0. Validation now rejects it upstream.
  it('reports zero for an unknown model — the reason validation rejects them', () => {
    expect(calcCost('some/unlisted-model', 1_000_000, 1_000_000)).toBe(0)
    expect(ALLOWED_MODELS).not.toContain('some/unlisted-model')
  })

  it('scales linearly for small token counts', () => {
    const one = calcCost('openai/gpt-4o-mini', 1000, 1000)
    const ten = calcCost('openai/gpt-4o-mini', 10_000, 10_000)
    expect(ten).toBeCloseTo(one * 10, 12)
  })
})
