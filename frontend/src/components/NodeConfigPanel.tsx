import { useState, useRef, useEffect } from 'react'
import { useWorkflowStore } from '../store/workflowStore'
import { streamExecuteWorkflow } from '../api/client'

const AVAILABLE_MODELS = [
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'anthropic/claude-sonnet-4-6',
  'anthropic/claude-haiku-4-5',
  'google/gemini-2.5-flash',
]

export function NodeConfigPanel() {
  const {
    nodes, edges, selectedNodeId,
    goal: storeGoal,
    updateNodeData, deleteNode,
    setNodeStatus, appendNodeOutput,
  } = useWorkflowStore()

  const node = nodes.find((n) => n.id === selectedNodeId)

  // Local state — only this panel cares about these
  const [retrying, setRetrying] = useState(false)
  const [copied,   setCopied]   = useState(false)

  // Ref to the output div so we can scroll it programmatically
  const outputRef = useRef<HTMLDivElement>(null)

  // After every render where output changed, scroll to the bottom.
  // useEffect runs AFTER the DOM update — so scrollHeight already includes new content.
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [node?.data.output])

  if (!node) return null

  const { data } = node

  // ── Retry ────────────────────────────────────────────────────────────────
  async function handleRetry() {
    if (retrying) return
    setRetrying(true)

    // Clear previous output and mark as idle before re-running
    updateNodeData(node.id, { output: undefined, status: 'idle' })

    // Find what this node depends on (its parent nodes)
    const parentIds = edges
      .filter((e) => e.target === node.id)
      .map((e) => e.source)

    // Build the context the node will receive.
    // No parents → use the original goal typed by the user.
    // Has parents → combine their stored outputs as context.
    let retryGoal: string
    if (parentIds.length === 0) {
      retryGoal = storeGoal || 'Complete your task.'
    } else {
      const context = parentIds
        .map((id) => {
          const parent = nodes.find((n) => n.id === id)
          return `[${parent?.data.label ?? id}]:\n${parent?.data.output ?? '(no output)'}`
        })
        .join('\n\n---\n\n')
      retryGoal = `[CONTEXT FROM PREVIOUS STEPS]\n${context}`
    }

    setNodeStatus(node.id, 'running')

    try {
      // Reuse the existing stream endpoint with just this one node.
      // Single node + no edges = topo sort returns [this node], runs once.
      await streamExecuteWorkflow(
        {
          nodes: [{
            id:           node.id,
            label:        data.label,
            model:        data.model,
            systemPrompt: data.systemPrompt,
            nodeType:     data.nodeType,
          }],
          edges: [],
          goal:  retryGoal,
        },
        (event) => {
          if      (event.type === 'node_token') appendNodeOutput(event.nodeId, event.token)
          else if (event.type === 'node_done')  setNodeStatus(event.nodeId, 'done')
          else if (event.type === 'error')      setNodeStatus(node.id, 'error')
        }
      )
    } catch {
      setNodeStatus(node.id, 'error')
    } finally {
      setRetrying(false)
    }
  }

  // ── Copy ─────────────────────────────────────────────────────────────────
  async function handleCopy() {
    if (!data.output) return
    await navigator.clipboard.writeText(data.output)
    setCopied(true)
    // Reset label back to "Copy" after 2 seconds
    setTimeout(() => setCopied(false), 2000)
  }

  const hasOutput = data.output !== undefined && data.output !== ''
  const isRunning = data.status === 'running'
  const isDone    = data.status === 'done'
  const isError   = data.status === 'error'

  return (
    <aside className="w-72 border-l bg-white flex flex-col shrink-0">
      {/* ── Header ── */}
      <div className="p-4 border-b flex items-start justify-between shrink-0">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Node Config
          </p>
          <p className="text-sm font-medium text-gray-700 mt-1 capitalize">
            {data.nodeType} node
          </p>
        </div>
        <button
          onClick={() => deleteNode(node.id)}
          className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors"
        >
          Delete
        </button>
      </div>

      {/* ── Fields ── */}
      <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">

        {/* Label */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Label</label>
          <input
            value={data.label}
            onChange={(e) => updateNodeData(node.id, { label: e.target.value })}
            className="border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        {/* Model */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Model</label>
          <select
            value={data.model}
            onChange={(e) => updateNodeData(node.id, { model: e.target.value })}
            className="border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* System prompt */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">System Prompt</label>
          <textarea
            value={data.systemPrompt}
            onChange={(e) => updateNodeData(node.id, { systemPrompt: e.target.value })}
            rows={5}
            className="border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        {/* Retry button — shown when node has been run (done or error) */}
        {(isDone || isError) && (
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 border border-blue-200 text-blue-500 hover:bg-blue-50 disabled:opacity-40 text-sm rounded-lg transition-colors"
          >
            <span>↺</span>
            {retrying ? 'Retrying…' : 'Retry Node'}
          </button>
        )}

        {/* Output — shown while running or after completion */}
        {(hasOutput || isRunning) && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-500">Output</label>
              {hasOutput && (
                <button
                  onClick={handleCopy}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              )}
            </div>

            {/* ref lets useEffect scroll this div to bottom on each new token */}
            <div
              ref={outputRef}
              className="border border-gray-200 rounded-md px-3 py-2 text-xs text-gray-700 bg-gray-50 h-52 overflow-y-auto whitespace-pre-wrap leading-relaxed"
            >
              {hasOutput
                ? data.output
                : <span className="text-gray-400 italic">Generating…</span>
              }
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
