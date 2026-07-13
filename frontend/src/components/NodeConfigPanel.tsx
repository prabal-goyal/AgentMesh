import { useState, useRef, useEffect } from 'react'
import { useWorkflowStore }   from '../store/workflowStore'
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

  const [retrying, setRetrying] = useState(false)
  const [copied,   setCopied]   = useState(false)

  const outputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [node?.data.output])

  if (!node) return null

  const { data } = node

  // ── Retry ────────────────────────────────────────────────────────────────
  async function handleRetry() {
    if (!node || retrying) return
    setRetrying(true)

    updateNodeData(node.id, { output: undefined, status: 'idle' })

    const parentIds = edges
      .filter((e) => e.target === node.id)
      .map((e) => e.source)

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
      await streamExecuteWorkflow(
        {
          nodes: [{
            id:           node.id,
            label:        data.label,
            model:        data.model,
            systemPrompt: data.systemPrompt,
            nodeType:     data.nodeType,
            condition:    data.condition as string | undefined,
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
    setTimeout(() => setCopied(false), 2000)
  }

  const hasOutput = data.output !== undefined && data.output !== ''
  const isRunning = data.status === 'running'
  const isDone    = data.status === 'done'
  const isError   = data.status === 'error'

  return (
    <aside className="w-72 border-l border-[#e2e8f0] bg-white flex flex-col flex-shrink-0">
      {/* ── Header ── */}
      <div className="px-4 py-3.5 border-b border-[#e2e8f0] flex items-start justify-between flex-shrink-0">
        <div>
          <p className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-[.07em]">
            Node Config
          </p>
          <p className="text-[13px] font-semibold text-[#0f172a] mt-1 capitalize">
            {data.nodeType} node
          </p>
        </div>
        <button
          onClick={() => deleteNode(node.id)}
          className="text-[12px] text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors">
          Delete
        </button>
      </div>

      {/* ── Fields ── */}
      <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">

        {/* Label */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-[#64748b] uppercase tracking-[.06em]">Label</label>
          <input
            value={data.label}
            onChange={(e) => updateNodeData(node.id, { label: e.target.value })}
            className="bg-[#f8fafc] border border-[#e2e8f0] rounded px-3 py-1.5 text-[13px] text-[#0f172a] outline-none focus:border-[#94a3b8] transition-colors"
          />
        </div>

        {/* Condition — only for Router nodes */}
        {data.nodeType === 'conditional' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[#64748b] uppercase tracking-[.06em]">Condition</label>
            <input
              value={(data.condition as string) ?? ''}
              onChange={(e) => updateNodeData(node.id, { condition: e.target.value })}
              placeholder="contains:approved"
              className="bg-[#f8fafc] border border-[#e2e8f0] rounded px-3 py-1.5 text-[13px] text-[#0f172a] outline-none focus:border-amber-400/60 transition-colors"
            />
            <p className="text-[11px] text-[#94a3b8] leading-relaxed">
              <span className="text-[#64748b] font-medium">contains:word</span> — YES if parent includes "word"<br />
              <span className="text-[#64748b] font-medium">not-contains:word</span> — YES if it does NOT
            </p>
          </div>
        )}

        {/* Model — hidden for Router nodes */}
        {data.nodeType !== 'conditional' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[#64748b] uppercase tracking-[.06em]">Model</label>
            <select
              value={data.model}
              onChange={(e) => updateNodeData(node.id, { model: e.target.value })}
              className="bg-[#f8fafc] border border-[#e2e8f0] rounded px-3 py-1.5 text-[13px] text-[#0f172a] outline-none focus:border-[#94a3b8] transition-colors">
              {AVAILABLE_MODELS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}

        {/* System Prompt — hidden for Router nodes */}
        {data.nodeType !== 'conditional' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[#64748b] uppercase tracking-[.06em]">System Prompt</label>
            <textarea
              value={data.systemPrompt}
              onChange={(e) => updateNodeData(node.id, { systemPrompt: e.target.value })}
              rows={5}
              className="bg-[#f8fafc] border border-[#e2e8f0] rounded px-3 py-1.5 text-[13px] text-[#0f172a] resize-none outline-none focus:border-[#94a3b8] transition-colors"
            />
          </div>
        )}

        {/* Retry button */}
        {(isDone || isError) && (
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="flex items-center justify-center gap-1.5 px-3 py-2 border border-[#e2e8f0] text-[#64748b] hover:border-[#94a3b8] hover:text-[#0f172a] hover:bg-[#f8fafc] disabled:opacity-40 text-[13px] rounded transition-all">
            {retrying ? 'Retrying…' : 'Retry Node'}
          </button>
        )}

        {/* Output */}
        {(hasOutput || isRunning) && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-[#64748b] uppercase tracking-[.06em]">Output</label>
              {hasOutput && (
                <button
                  onClick={handleCopy}
                  className="text-[12px] text-[#94a3b8] hover:text-[#64748b] transition-colors">
                  {copied ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
            <div
              ref={outputRef}
              className="border border-[#e2e8f0] rounded px-3 py-2 text-[12px] text-[#374151] bg-[#f8fafc] h-52 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {hasOutput
                ? data.output
                : <span className="text-[#94a3b8] italic">Generating…</span>
              }
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
