import { useWorkflowStore } from '../store/workflowStore'
import { streamExecuteWorkflow } from '../api/client'

export function RunButton() {
  const {
    nodes, edges, goal,
    executing, setExecuting,
    setNodeStatus, appendNodeOutput,
    resetExecution,
  } = useWorkflowStore()

  const canRun = nodes.length > 0 && !executing

  async function handleRun() {
    if (!canRun) return

    // Clear previous outputs and reset all nodes to idle
    resetExecution()
    setExecuting(true)

    try {
      await streamExecuteWorkflow(
        {
          nodes: nodes.map((n) => ({
            id:           n.id,
            label:        n.data.label,
            model:        n.data.model,
            systemPrompt: n.data.systemPrompt,
            nodeType:     n.data.nodeType,
            condition:    n.data.condition as string | undefined,
          })),
          // sourceHandle must be preserved: the executor reads it to know
          // which branch ('yes' or 'no') an edge belongs to for DAG pruning
          edges: edges.map((e) => ({
            source:       e.source,
            target:       e.target,
            sourceHandle: e.sourceHandle ?? undefined,
          })),
          goal,
        },
        (event) => {
          if      (event.type === 'node_start')   setNodeStatus(event.nodeId, 'running')
          else if (event.type === 'node_token')   appendNodeOutput(event.nodeId, event.token)
          else if (event.type === 'node_done')    setNodeStatus(event.nodeId, 'done')
          else if (event.type === 'node_skipped') setNodeStatus(event.nodeId, 'skipped')
          else if (event.type === 'error') {
            nodes.forEach((n) => setNodeStatus(n.id, 'error'))
            console.error('Execution error:', event.message)
          }
        }
      )
    } catch (err) {
      nodes.forEach((n) => setNodeStatus(n.id, 'error'))
      console.error('Stream failed:', err)
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
