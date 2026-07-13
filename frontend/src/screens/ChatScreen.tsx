import { useEffect, useState } from 'react'
import { useWorkflowStore }   from '../store/workflowStore'
import { generatePlan }       from '../api/client'
import type { WorkflowNode, WorkflowEdge, NodeType } from '../types/workflow'

const NODE_TYPE_LABEL: Record<string, string> = {
  research: 'Research', writer: 'Writer', critic: 'Critic', custom: 'Custom', conditional: 'Router',
}

export function ChatScreen() {
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [planData, setPlanData] = useState<Awaited<ReturnType<typeof generatePlan>> | null>(null)

  const goal                 = useWorkflowStore((s) => s.goal)
  const setScreen            = useWorkflowStore((s) => s.setScreen)
  const setWorkflow          = useWorkflowStore((s) => s.setWorkflow)
  const addSidebarMessage    = useWorkflowStore((s) => s.addSidebarMessage)
  const clearSidebarMessages = useWorkflowStore((s) => s.clearSidebarMessages)

  // Fire the plan API call on mount — brief delay lets the "thinking" animation show first
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const plan = await generatePlan(goal)
        if (!cancelled) setPlanData(plan)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to generate plan')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 500)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [goal])

  function handleBuild() {
    if (!planData) return

    const nodes: WorkflowNode[] = planData.nodes.map((n, i) => ({
      id:   n.id,
      type: n.type,
      position: { x: 80 + i * 280, y: 200 },
      data: {
        label:        n.label,
        nodeType:     n.type as NodeType,
        model:        n.model,
        systemPrompt: n.systemPrompt,
        status:       'idle' as const,
        ...(n.condition !== undefined ? { condition: n.condition } : {}),
      },
    }))

    const nodeTypeById = Object.fromEntries(planData.nodes.map((n) => [n.id, n.type]))

    const edges: WorkflowEdge[] = planData.edges.map((e, i) => {
      const isRouter = nodeTypeById[e.source] === 'conditional'
      return {
        id:           `e-${i}`,
        source:       e.source,
        target:       e.target,
        sourceHandle: e.sourceHandle,
        ...(isRouter && e.sourceHandle ? {
          label:        e.sourceHandle === 'yes' ? 'Yes' : 'No',
          style:        { stroke: e.sourceHandle === 'yes' ? '#16a34a' : '#dc2626' },
          labelStyle:   { fill: e.sourceHandle === 'yes' ? '#16a34a' : '#dc2626', fontWeight: 600, fontSize: 11 },
          labelBgStyle: { fill: '#ffffff', fillOpacity: 1 },
        } : {}),
      }
    })

    clearSidebarMessages()
    addSidebarMessage({ role: 'user', content: goal })
    const hasRouter = planData.nodes.some((n) => n.type === 'conditional')
    addSidebarMessage({
      role: 'ai',
      content: `Built a ${planData.nodes.length}-agent workflow.${hasRouter ? ' A Router node handles conditional branching based on output quality.' : ''} Click any node to inspect or edit it.`,
    })

    setWorkflow(nodes, edges)
    setScreen('generating')
  }

  return (
    <div className="h-screen bg-white flex flex-col">
      {/* ── Header ── */}
      <div className="h-[52px] border-b border-[#e2e8f0] bg-white flex items-center px-4 gap-3 flex-shrink-0">
        <button
          onClick={() => setScreen('home')}
          className="px-3 py-1.5 rounded text-[13px] border border-[#e2e8f0] text-[#64748b] hover:border-[#94a3b8] hover:text-[#0f172a] transition-all">
          Back
        </button>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-[#0f172a] rounded flex items-center justify-center text-white text-[9px] font-bold">A</div>
          <span className="text-[13px] font-semibold text-[#0f172a]">AgentMesh Studio</span>
        </div>
        <span className="text-[12px] text-[#94a3b8] ml-auto">New workflow</span>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto py-10 flex flex-col items-center">
        <div className="w-full max-w-[680px] px-6 flex flex-col gap-5">

          {/* User bubble */}
          <div className="flex justify-end">
            <div className="max-w-[80%] px-4 py-3 text-[14px] leading-[1.6] text-white bg-[#0f172a]"
              style={{ borderRadius: '12px 12px 3px 12px' }}>
              {goal || '(no goal entered)'}
            </div>
          </div>

          {/* AI response */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 bg-[#0f172a] rounded flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">A</div>
              <span className="text-[12px] font-semibold text-[#64748b]">AgentMesh</span>
            </div>

            {/* Thinking dots */}
            {loading && (
              <div className="flex items-center gap-[5px] px-4 py-3 bg-[#f8fafc] border border-[#e2e8f0] rounded w-fit"
                style={{ borderRadius: '3px 12px 12px 12px' }}>
                {[0, 200, 400].map((delay) => (
                  <div key={delay} className="w-[7px] h-[7px] rounded-full bg-[#cbd5e1]"
                    style={{ animation: `bounce 0.9s ease-in-out ${delay}ms infinite` }} />
                ))}
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="px-4 py-3 bg-[#fef2f2] border border-red-200 text-[14px] text-red-600"
                style={{ borderRadius: '3px 12px 12px 12px' }}>
                {error} —{' '}
                <button onClick={() => setScreen('home')} className="underline hover:no-underline">go back</button>
              </div>
            )}

            {/* Plan response */}
            {planData && !loading && (
              <>
                <div className="px-4 py-3 bg-[#f8fafc] border border-[#e2e8f0] text-[14px] text-[#64748b] leading-[1.7]"
                  style={{ borderRadius: '3px 12px 12px 12px' }}>
                  I'll build a{' '}
                  <span className="text-[#0f172a] font-semibold">{planData.nodes.length}-step workflow</span>{' '}
                  for this. Here's my plan:
                </div>

                {/* ── Plan card ── */}
                <div className="mt-4 rounded border border-[#e2e8f0] overflow-hidden bg-white">
                  <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8fafc]">
                    <span className="text-[12px] font-semibold text-[#0f172a]">Proposed Workflow</span>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded text-[#4f46e5] bg-[#eef2ff] border border-[#c7d2fe]">
                      {planData.nodes.length} agents
                    </span>
                  </div>

                  <div className="px-4 py-3 flex flex-col gap-1.5">
                    {planData.nodes.map((n, i) => (
                      <div key={n.id}>
                        <div className="flex items-center gap-3 px-3 py-2.5 rounded bg-[#f8fafc] border border-[#e2e8f0]">
                          <div className="w-1 h-8 rounded-full flex-shrink-0"
                            style={{ background: n.type === 'conditional' ? '#ca8a04' : n.type === 'research' ? '#2563eb' : n.type === 'writer' ? '#7c3aed' : n.type === 'critic' ? '#0f766e' : '#475569' }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold text-[#0f172a] truncate">{n.label}</div>
                            <div className="text-[11px] text-[#94a3b8] mt-[1px] truncate">
                              {n.type === 'conditional' ? (n.condition || 'condition router') : n.model}
                            </div>
                          </div>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded text-[#64748b] bg-[#f1f5f9] border border-[#e2e8f0]">
                            {NODE_TYPE_LABEL[n.type] ?? n.type}
                          </span>
                        </div>
                        {i < planData.nodes.length - 1 && (
                          <div className="flex justify-center text-[#cbd5e1] text-[12px] py-0.5">|</div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="px-4 pb-4 pt-2 flex gap-2 border-t border-[#e2e8f0] bg-[#f8fafc]">
                    <button
                      onClick={handleBuild}
                      className="flex-1 py-2.5 rounded text-[13px] font-semibold text-white bg-[#0f172a] hover:bg-[#1e293b] transition-colors">
                      Build this workflow
                    </button>
                    <button
                      onClick={() => setScreen('home')}
                      className="px-4 py-2.5 rounded text-[13px] font-medium border border-[#e2e8f0] text-[#64748b] hover:border-[#94a3b8] hover:text-[#0f172a] transition-all">
                      Adjust
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Chat input ── */}
      <div className="border-t border-[#e2e8f0] px-6 py-4 flex gap-2.5 items-center bg-white">
        <input
          placeholder="Add a requirement or ask to change something…"
          className="flex-1 bg-[#f8fafc] border border-[#e2e8f0] rounded px-4 py-2.5 text-[14px] text-[#0f172a] placeholder-[#94a3b8] outline-none focus:border-[#94a3b8] transition-colors"
        />
        <button className="w-9 h-9 rounded bg-[#0f172a] text-white flex items-center justify-center text-[14px] hover:bg-[#1e293b] transition-colors">
          ↑
        </button>
      </div>
    </div>
  )
}
