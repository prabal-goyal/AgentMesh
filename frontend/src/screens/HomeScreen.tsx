import { useRef, useState, useEffect } from 'react'
import { useWorkflowStore } from '../store/workflowStore'
import { MyWorkflowsPanel } from '../components/MyWorkflowsPanel'

const EXAMPLES = [
  { label: 'Research top AI tools in 2025 and create a comparison report',       short: 'AI tools research report' },
  { label: 'Write a blog post about climate tech startups in 2025',              short: 'Climate tech blog post' },
  { label: 'Analyze a codebase and suggest concrete improvements with examples', short: 'Code review workflow' },
  { label: 'Research our competitors and write a detailed SWOT analysis',        short: 'Competitor SWOT analysis' },
]

export function HomeScreen() {
  const goal                 = useWorkflowStore((s) => s.goal)
  const setGoal              = useWorkflowStore((s) => s.setGoal)
  const setScreen            = useWorkflowStore((s) => s.setScreen)
  const setWorkflow          = useWorkflowStore((s) => s.setWorkflow)
  const clearSidebarMessages = useWorkflowStore((s) => s.clearSidebarMessages)
  const user                 = useWorkflowStore((s) => s.user)
  const logout                = useWorkflowStore((s) => s.logout)
  const savedWorkflows        = useWorkflowStore((s) => s.savedWorkflows)
  const refreshSavedWorkflows = useWorkflowStore((s) => s.refreshSavedWorkflows)
  const loadSavedWorkflow     = useWorkflowStore((s) => s.loadSavedWorkflow)
  const textareaRef          = useRef<HTMLTextAreaElement>(null)

  const [showWorkflowsPanel, setShowWorkflowsPanel] = useState(false)

  // Loads the list once on mount so the Recent strip has data without
  // requiring the user to open the My Workflows panel first
  useEffect(() => {
    refreshSavedWorkflows()
  }, [refreshSavedWorkflows])

  function handleBuild() {
    if (!goal.trim()) return
    clearSidebarMessages()
    setScreen('chat')
  }

  function fillAndGo(text: string) {
    setGoal(text)
    clearSidebarMessages()
    setScreen('chat')
  }

  function handleCustomBuild() {
    setGoal('')
    setWorkflow([], [])
    clearSidebarMessages()
    setScreen('builder')
  }

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden relative">

      {/* ── Nav ── */}
      <nav className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-5 z-10 border-b border-[#e2e8f0] bg-white">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 bg-[#0f172a] rounded flex items-center justify-center text-white text-[11px] font-bold tracking-tight">
            A
          </div>
          <span className="text-[14px] font-semibold text-[#0f172a] tracking-tight">AgentMesh</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleCustomBuild}
            className="px-3 py-1.5 rounded text-[13px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-colors">
            Builder
          </button>
          <button className="px-3 py-1.5 rounded text-[13px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-colors">
            Templates
          </button>
          <button className="px-3 py-1.5 rounded text-[13px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-colors">
            Docs
          </button>
          <button onClick={handleCustomBuild}
            className="ml-2 px-4 py-1.5 rounded text-[13px] font-medium bg-[#0f172a] text-white hover:bg-[#1e293b] transition-colors">
            Open Builder
          </button>

          {/* HomeScreen only ever renders while logged in (see App.tsx's auth
              gate), so user is never null here in practice — the check below
              is just to satisfy the AuthUser | null type. */}
          {user && (
            <div className="flex items-center gap-2 ml-2 pl-3 border-l border-[#e2e8f0]">
              <span className="text-[13px] text-[#64748b]">{user.email}</span>
              <button onClick={logout}
                className="px-3 py-1.5 rounded text-[13px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-colors">
                Log out
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center" style={{ paddingTop: '56px' }}>

        <p className="text-[12px] font-semibold tracking-[0.14em] uppercase text-[#94a3b8] mb-6">
          AI Workflow Studio
        </p>

        <h1 className="text-[48px] font-bold text-[#0f172a] leading-[1.1] tracking-[-1.5px] mb-4 max-w-[620px]">
          What do you want to build?
        </h1>

        <p className="text-[16px] text-[#64748b] mb-10 max-w-[460px] leading-[1.65]">
          Describe any task. AgentMesh designs a multi-agent workflow, builds it on the canvas, and runs it.
        </p>

        {/* ── Input card ── */}
        <div className="w-full max-w-[600px] mb-4 border border-[#e2e8f0] rounded-md bg-white shadow-sm
          focus-within:border-[#94a3b8] focus-within:shadow-[0_0_0_3px_rgba(148,163,184,.12)] transition-all">
          <textarea
            ref={textareaRef}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleBuild() } }}
            placeholder="Describe your task — e.g. Research the top YC W25 startups and write a summary report"
            rows={3}
            className="w-full bg-transparent text-[#0f172a] text-[15px] resize-none leading-[1.6] placeholder-[#94a3b8] outline-none px-4 pt-4"
          />
          <div className="flex items-center justify-between px-4 pb-3 pt-2 border-t border-[#f1f5f9]">
            <span className="text-[12px] text-[#94a3b8]">Enter to generate · Shift+Enter for new line</span>
            <button
              onClick={handleBuild}
              disabled={!goal.trim()}
              className="px-5 py-2 rounded text-[13px] font-semibold text-white bg-[#0f172a] hover:bg-[#1e293b] disabled:opacity-30 transition-colors">
              Generate workflow
            </button>
          </div>
        </div>

        {/* ── Example prompts ── */}
        <div className="flex flex-wrap justify-center gap-2 max-w-[600px] mb-10">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.short}
              onClick={() => fillAndGo(ex.label)}
              className="px-3.5 py-1.5 rounded text-[12.5px] text-[#475569] border border-[#e2e8f0] bg-white
                hover:border-[#94a3b8] hover:text-[#0f172a] hover:bg-[#f8fafc] transition-all">
              {ex.short}
            </button>
          ))}
        </div>

        {/* ── Divider ── */}
        <div className="flex items-center gap-4 w-full max-w-[600px] mb-8">
          <div className="flex-1 h-px bg-[#e2e8f0]" />
          <span className="text-[12px] text-[#94a3b8]">or</span>
          <div className="flex-1 h-px bg-[#e2e8f0]" />
        </div>

        {/* ── Secondary actions ── */}
        <div className="flex gap-2">
          {[
            { label: 'Open Canvas',      onClick: handleCustomBuild },
            { label: 'Browse Templates', onClick: undefined },
            { label: 'My Workflows',     onClick: () => setShowWorkflowsPanel(true) },
          ].map(({ label, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="px-4 py-2 rounded text-[13px] text-[#475569] border border-[#e2e8f0]
                hover:border-[#94a3b8] hover:text-[#0f172a] hover:bg-[#f8fafc] transition-all">
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Recent (bottom) ── */}
      {savedWorkflows.length > 0 && (
        <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-3">
          <p className="text-[11px] text-[#94a3b8] uppercase tracking-[.08em] font-medium">Recent</p>
          <div className="flex gap-2">
            {savedWorkflows.slice(0, 3).map((wf) => (
              <button key={wf.id} onClick={() => loadSavedWorkflow(wf.id)}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-[12px] border border-[#e2e8f0] text-[#64748b] cursor-pointer
                  hover:text-[#0f172a] hover:border-[#94a3b8] hover:bg-[#f8fafc] transition-all">
                <div className="w-[5px] h-[5px] rounded-full bg-green-500 flex-shrink-0" />
                {wf.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {showWorkflowsPanel && (
        <MyWorkflowsPanel onClose={() => setShowWorkflowsPanel(false)} />
      )}
    </div>
  )
}
