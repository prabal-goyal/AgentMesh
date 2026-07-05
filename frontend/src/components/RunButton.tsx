import { useWorkflowStore } from '../store/workflowStore'
import { executeWorkflow } from '../api/client'

export function RunButton() {
  const {
    nodes, edges, goal,
    executing, setExecuting,
    setNodeStatus, setNodeOutput,
  } = useWorkflowStore()

  const canRun = nodes.length > 0 && !executing

  async function handleRun() {
    if (!canRun) return

    setExecuting(true)

    // Mark every node as running so the canvas turns blue immediately
    nodes.forEach((n) => setNodeStatus(n.id, 'running'))

    try {
      const { results } = await executeWorkflow({
        // Only send what the backend needs — not positions or React Flow internals
        nodes: nodes.map((n) => ({
          id:           n.id,
          label:        n.data.label,
          model:        n.data.model,
          systemPrompt: n.data.systemPrompt,
        })),
        edges: edges.map((e) => ({ source: e.source, target: e.target })),
        goal,
      })

      // Apply each node's output and mark it done
      Object.entries(results).forEach(([id, output]) => {
        setNodeOutput(id, output)
        setNodeStatus(id, 'done')
      })
    } catch (err) {
      // Mark all nodes as error so the canvas turns red
      nodes.forEach((n) => setNodeStatus(n.id, 'error'))
      console.error('Execution failed:', err)
    } finally {
      setExecuting(false)
    }
  }

  return (
    <button
      onClick={handleRun}
      disabled={!canRun}
      className="px-4 py-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
    >
      {executing ? 'Running…' : '▶ Run Workflow'}
    </button>
  )
}
