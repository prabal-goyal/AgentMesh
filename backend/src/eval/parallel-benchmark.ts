import 'dotenv/config'
import { resolveModel } from '../lib/openrouter.js'
import {
  streamExecuteWorkflow,
  topoWaves,
  buildUserMessage,
  type NodeInput,
  type EdgeInput,
} from '../lib/executor.js'

// Measures what wave-based parallel execution actually buys over running the
// same DAG one node at a time.
//
// The sequential baseline lives HERE rather than in lib/, deliberately. It used
// to be executeWorkflow() in the executor, kept "for reference" behind a route
// nothing called — dead code in a file reviewers read. Owning a copy in the
// benchmark keeps the comparison reproducible without shipping it.

const FANOUT = 3      // children that can run concurrently
const ITERATIONS = 3  // per mode; small because each one costs real tokens
const MODEL = 'google/gemini-2.5-flash'

// One root, then FANOUT independent children — topoWaves yields two waves, and
// the second is where parallelism pays.
function buildGraph(): { nodes: NodeInput[]; edges: EdgeInput[] } {
  const nodes: NodeInput[] = [{
    id: '1', label: 'Root', model: MODEL, nodeType: 'writer',
    systemPrompt: 'Reply with exactly one short sentence about the ocean.',
  }]
  const edges: EdgeInput[] = []

  for (let i = 0; i < FANOUT; i++) {
    const id = String(i + 2)
    nodes.push({
      id, label: `Child ${i + 1}`, model: MODEL, nodeType: 'writer',
      systemPrompt: 'Reply with exactly one short sentence expanding on the input.',
    })
    edges.push({ source: '1', target: id })
  }

  return { nodes, edges }
}

// The old executeWorkflow, preserved as the baseline: topological order,
// flattened, one provider call at a time.
async function runSequential(nodes: NodeInput[], edges: EdgeInput[], goal: string) {
  const outputs: Record<string, string> = {}

  for (const node of topoWaves(nodes, edges).flat()) {
    const { client, model } = resolveModel(node.model)
    const response = await client.chat.completions.create({
      model,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: node.systemPrompt },
        { role: 'user',   content: buildUserMessage(node, nodes, edges, outputs, goal) },
      ],
    })
    outputs[node.id] = response.choices[0].message.content ?? ''
  }

  return outputs
}

async function runParallel(nodes: NodeInput[], edges: EdgeInput[], goal: string) {
  await streamExecuteWorkflow(nodes, edges, goal, () => { /* discard events */ })
}

async function time(label: string, fn: () => Promise<unknown>): Promise<number> {
  const startedAt = Date.now()
  await fn()
  const ms = Date.now() - startedAt
  console.log(`  ${label.padEnd(12)} ${String(ms).padStart(6)}ms`)
  return ms
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

async function main() {
  const { nodes, edges } = buildGraph()
  const goal = 'Describe the ocean.'
  const waves = topoWaves(nodes, edges)

  console.log(`\nParallel vs sequential — ${nodes.length} nodes, ${waves.length} waves ` +
              `(${waves.map((w) => w.length).join(' then ')}), ${MODEL}\n`)

  const sequential: number[] = []
  const parallel: number[] = []

  for (let i = 0; i < ITERATIONS; i++) {
    console.log(`run ${i + 1}:`)
    sequential.push(await time('sequential', () => runSequential(nodes, edges, goal)))
    parallel.push(await time('parallel', () => runParallel(nodes, edges, goal)))
  }

  const seqMedian = median(sequential)
  const parMedian = median(parallel)
  const speedup = (seqMedian / parMedian).toFixed(2)
  const saved = Math.round(((seqMedian - parMedian) / seqMedian) * 100)

  console.log(`\nmedian sequential : ${seqMedian}ms`)
  console.log(`median parallel   : ${parMedian}ms`)
  console.log(`speedup           : ${speedup}x (${saved}% faster)\n`)
  console.log(`Ceiling for this shape is ~${((1 + FANOUT) / 2).toFixed(2)}x: the root is`)
  console.log(`unavoidably serial, and only the ${FANOUT} children collapse into one wave.\n`)
}

main().catch((err) => {
  console.error('Benchmark failed:', err)
  process.exit(1)
})
