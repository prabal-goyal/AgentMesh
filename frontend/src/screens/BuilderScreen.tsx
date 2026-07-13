import { useRef, useEffect } from 'react'
import { useWorkflowStore }      from '../store/workflowStore'
import { streamExecuteWorkflow } from '../api/client'
import { Canvas }                from '../components/Canvas'
import { NodeConfigPanel }       from '../components/NodeConfigPanel'
import type { NodeType }         from '../types/workflow'

const NODE_TYPES: { type: NodeType; label: string }[] = [
  { type: 'research',    label: 'Research' },
  { type: 'writer',      label: 'Writer'   },
  { type: 'critic',      label: 'Critic'   },
  { type: 'custom',      label: 'Custom'   },
  { type: 'conditional', label: 'Router'   },
]

// Status config for live output node cards — light theme
const STATUS_CFG = {
  done:    { bg: 'rgba(22,163,74,.06)',   border: 'rgba(22,163,74,.22)',  color: '#16a34a', label: 'Done'    },
  running: { bg: 'rgba(59,130,246,.06)', border: 'rgba(59,130,246,.22)', color: '#2563eb', label: 'Running' },
  skipped: { bg: '#f8fafc',              border: '#e2e8f0',              color: '#94a3b8', label: 'Skipped' },
  error:   { bg: 'rgba(220,38,38,.04)',  border: 'rgba(220,38,38,.15)',  color: '#dc2626', label: 'Error'   },
} as const

export function BuilderScreen() {
  const {
    nodes, edges, goal, screen, executing, selectedNodeId,
    sidebarMessages,
    resetExecution, setExecuting, setScreen, setRunTiming,
    setNodeStatus, appendNodeOutput,
    addNode,
  } = useWorkflowStore()

  // Auto-scroll the live output panel to the bottom on every token
  const outputRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  })

  const canRun    = nodes.length > 0 && !executing
  const isRunning = screen === 'running'

  // Only nodes that have left idle state — shown in Live Output
  const activeNodes = nodes.filter((n) => n.data.status !== 'idle' || n.data.output)

  const flowName = goal
    ? (goal.length > 44 ? goal.slice(0, 44) + '…' : goal)
    : 'Custom Workflow'

  async function handleRun() {
    if (!canRun) return

    resetExecution()
    setExecuting(true)
    setScreen('running')
    const startTime = Date.now()

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
          // sourceHandle tells the executor which branch (yes/no) each edge belongs to
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
          else if (event.type === 'error')        nodes.forEach((n) => setNodeStatus(n.id, 'error'))
        }
      )
      setRunTiming(startTime, Date.now())
      setScreen('results')
    } catch {
      nodes.forEach((n) => setNodeStatus(n.id, 'error'))
      setScreen('builder')
    } finally {
      setExecuting(false)
    }
  }

  return (
    <div className="h-screen bg-white flex flex-col">

      {/* ════ Top bar ════ */}
      <div className="h-[50px] bg-white border-b border-[#e2e8f0] flex items-center px-4 gap-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-[#0f172a] rounded flex items-center justify-center text-white text-[9px] font-bold">A</div>
          <span className="text-[13px] font-semibold text-[#0f172a]">AgentMesh</span>
        </div>

        <div className="w-px h-4 bg-[#e2e8f0] mx-1" />

        <span className="text-[13px] text-[#64748b] truncate max-w-[220px]">{flowName}</span>

        {isRunning ? (
          <span className="ml-1 text-[11px] font-semibold px-2 py-[2px] rounded bg-blue-50 border border-blue-200 text-blue-600 whitespace-nowrap">
            Running
          </span>
        ) : nodes.length > 0 ? (
          <span className="ml-1 text-[11px] font-semibold px-2 py-[2px] rounded bg-green-50 border border-green-200 text-green-700 whitespace-nowrap">
            Ready
          </span>
        ) : null}

        <button
          onClick={handleRun}
          disabled={!canRun}
          className="ml-auto px-4 py-1.5 rounded text-[13px] font-semibold bg-[#0f172a] text-white hover:bg-[#1e293b] disabled:opacity-40 transition-colors">
          Run Workflow
        </button>

        <button
          onClick={() => setScreen('home')}
          className="px-3 py-1.5 rounded text-[13px] border border-[#e2e8f0] text-[#64748b] hover:border-[#94a3b8] hover:text-[#0f172a] transition-all">
          Home
        </button>
      </div>

      {/* ════ Body ════ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ════ Left sidebar ════ */}
        <div className="w-[280px] border-r border-[#e2e8f0] flex flex-col flex-shrink-0 bg-[#f8fafc]">

          {/* ── Sidebar header ── */}
          <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between flex-shrink-0 bg-white">
            <div className="flex items-center gap-2">
              {isRunning && (
                <span className="w-[6px] h-[6px] rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
              )}
              <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-[.1em]">
                {isRunning ? 'Live Output' : 'AI Director'}
              </span>
            </div>
            <button
              onClick={() => setScreen('home')}
              className="text-[11px] text-[#94a3b8] hover:text-[#64748b] px-2 py-1 rounded transition-colors">
              Home
            </button>
          </div>

          {/* ── Scrollable content area ── */}
          <div ref={outputRef} className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-3">

            {isRunning ? (
              /* ══ Live Output mode ══ */
              activeNodes.length === 0 ? (
                <div className="flex items-center gap-2 text-[13px] text-[#94a3b8] italic">
                  <span className="w-[5px] h-[5px] rounded-full bg-blue-400 animate-pulse" />
                  Starting workflow…
                </div>
              ) : (
                activeNodes.map((n) => {
                  const status = n.data.status as keyof typeof STATUS_CFG
                  const cfg = STATUS_CFG[status] ?? STATUS_CFG.running
                  return (
                    <div key={n.id} className="rounded overflow-hidden flex-shrink-0"
                      style={{ border: `1px solid ${cfg.border}` }}>
                      {/* Node card header */}
                      <div className="px-3 py-2 flex items-center gap-2"
                        style={{ background: cfg.bg }}>
                        <span className="text-[13px] font-semibold text-[#0f172a] flex-1 truncate">
                          {n.data.label}
                        </span>
                        {n.data.status === 'running' ? (
                          <span className="text-[11px] animate-pulse" style={{ color: cfg.color }}>●</span>
                        ) : (
                          <span className="text-[10.5px] font-semibold" style={{ color: cfg.color }}>
                            {cfg.label}
                          </span>
                        )}
                      </div>
                      {/* Node output / status body */}
                      {n.data.output ? (
                        <div className="px-3 py-2.5 text-[12px] text-[#374151] leading-[1.7] whitespace-pre-wrap bg-white max-h-[140px] overflow-y-auto">
                          {n.data.output}
                        </div>
                      ) : n.data.status === 'running' ? (
                        <div className="px-3 py-2.5 text-[12px] text-[#94a3b8] italic bg-white">
                          Generating…
                        </div>
                      ) : n.data.status === 'skipped' ? (
                        <div className="px-3 py-2.5 text-[12px] text-[#94a3b8] italic bg-white">
                          Branch not taken — skipped
                        </div>
                      ) : null}
                    </div>
                  )
                })
              )
            ) : (
              /* ══ AI Director mode ══ */
              <>
                {sidebarMessages.length === 0 ? (
                  <div className="px-1 text-[13px] text-[#94a3b8] leading-[1.7]">
                    Add nodes using the panel below, or go back to Home to describe a goal and let the AI design the workflow for you.
                  </div>
                ) : (
                  sidebarMessages.map((msg) =>
                    msg.role === 'user' ? (
                      /* User bubble — right aligned */
                      <div key={msg.id} className="flex justify-end">
                        <div
                          className="max-w-[88%] px-3 py-2.5 text-[13px] leading-[1.6] text-white bg-[#0f172a]"
                          style={{ borderRadius: '12px 12px 3px 12px' }}>
                          {msg.content}
                        </div>
                      </div>
                    ) : (
                      /* AI message — left aligned */
                      <div key={msg.id} className="flex gap-2.5 items-start">
                        <div className="w-5 h-5 bg-[#0f172a] rounded flex-shrink-0 flex items-center justify-center text-white text-[8px] font-bold mt-[2px]">
                          A
                        </div>
                        <div
                          className="flex-1 min-w-0 px-3 py-2.5 text-[13px] leading-[1.65] text-[#374151] bg-white border border-[#e2e8f0]"
                          style={{ borderRadius: '3px 12px 12px 12px' }}>
                          {msg.content}
                        </div>
                      </div>
                    )
                  )
                )}

                {/* Tip card — only shown when there's context from AI */}
                {sidebarMessages.length > 0 && (
                  <div className="px-3 py-2.5 rounded text-[12.5px] leading-[1.65] text-[#64748b] bg-[#eef2ff] border border-[#c7d2fe]">
                    Click any node to inspect or edit its system prompt, model, and live output.
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Add Node panel — hidden while running ── */}
          {!isRunning && (
            <div className="border-t border-[#e2e8f0] px-3 pt-3 pb-3 bg-white">
              <p className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-[.1em] mb-2">
                Add Node
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {NODE_TYPES.map(({ type, label }) => (
                  <button
                    key={type}
                    onClick={() => addNode(type)}
                    className="px-3 py-2 rounded text-left text-[12px] font-medium text-[#64748b] border border-[#e2e8f0] bg-[#f8fafc] hover:border-[#94a3b8] hover:text-[#0f172a] hover:bg-white transition-all">
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Reset outputs button — only after a run ── */}
          {!isRunning && nodes.some((n) => n.data.status !== 'idle') && (
            <div className="px-3 pb-3 border-t border-[#e2e8f0] pt-2.5 bg-white">
              <button
                onClick={resetExecution}
                className="w-full py-2 rounded text-[12px] text-[#94a3b8] hover:text-[#64748b] border border-[#e2e8f0] hover:border-[#94a3b8] transition-all">
                Reset outputs
              </button>
            </div>
          )}
        </div>

        {/* ════ Canvas ════ */}
        <main className="flex-1 overflow-hidden">
          <Canvas />
        </main>

        {/* ════ Node config panel (right side) ════ */}
        {selectedNodeId && <NodeConfigPanel />}
      </div>
    </div>
  )
}
