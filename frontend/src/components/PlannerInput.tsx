import { useState } from 'react'
import { generatePlan } from '../api/client'
import { useWorkflowStore } from '../store/workflowStore'
import type { WorkflowNode, WorkflowEdge, NodeType } from '../types/workflow'

export function PlannerInput() {
  const [goal, setGoal]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const setWorkflow           = useWorkflowStore((state) => state.setWorkflow)

  async function handleGenerate() {
    if (!goal.trim()) return

    setLoading(true)
    setError(null)

    try {
      const plan = await generatePlan(goal)

      // The AI returns nodes without positions — we assign them here.
      // Simple horizontal layout: each node is 280px to the right of the previous one.
      const nodes: WorkflowNode[] = plan.nodes.map((n, i) => ({
        id: n.id,
        type: n.type,
        position: { x: 80 + i * 280, y: 200 },
        data: {
          label:        n.label,
          nodeType:     n.type as NodeType,
          model:        n.model,
          systemPrompt: n.systemPrompt,
          status:       'idle',
        },
      }))

      // Edges from the AI already have source/target — just add a unique id
      const edges: WorkflowEdge[] = plan.edges.map((e, i) => ({
        id:     `e-${i}`,
        source: e.source,
        target: e.target,
      }))

      setWorkflow(nodes, edges)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      // finally always runs — clears loading whether it succeeded or failed
      setLoading(false)
    }
  }

  return (
    <header className="flex items-center gap-3 px-4 py-3 bg-white border-b shrink-0">
      <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
        AgentMesh
      </span>

      <div className="flex-1 flex items-center gap-2">
        <input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          placeholder="Describe your goal… e.g. Research AI trends and write a blog post"
          disabled={loading}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50"
        />
        <button
          onClick={handleGenerate}
          disabled={loading || !goal.trim()}
          className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
        >
          {loading ? 'Generating…' : 'Generate Workflow'}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-500 whitespace-nowrap">{error}</p>
      )}
    </header>
  )
}
