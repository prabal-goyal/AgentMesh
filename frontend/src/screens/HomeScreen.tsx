import { useRef, useState, useEffect } from 'react'
import { useWorkflowStore } from '../store/workflowStore'
import { MyWorkflowsPanel } from '../components/MyWorkflowsPanel'
import { formatUpdatedAt } from '../lib/formatDate'

// Fill-only: clicking one puts the text in the box so the user can edit it
// before planning — one path in, no shortcut that skips a step
const EXAMPLES = [
  'Write a blog post about the benefits of remote work',
  'Summarise the latest news on electric cars',
  'Compare three popular project management tools',
]

const HOW_IT_WORKS = [
  { title: 'Describe',        text: 'what you want done' },
  { title: 'Check the steps', text: 'AgentMesh plans, and change anything you like' },
  { title: 'Run it',          text: 'and watch the results appear' },
]

const RECENT_LIMIT = 5

export function HomeScreen() {
  const goal                  = useWorkflowStore((s) => s.goal)
  const setGoal               = useWorkflowStore((s) => s.setGoal)
  const setScreen             = useWorkflowStore((s) => s.setScreen)
  const clearSidebarMessages  = useWorkflowStore((s) => s.clearSidebarMessages)
  const logout                = useWorkflowStore((s) => s.logout)
  const savedWorkflows        = useWorkflowStore((s) => s.savedWorkflows)
  const savedWorkflowsLoading = useWorkflowStore((s) => s.savedWorkflowsLoading)
  const savedWorkflowsError   = useWorkflowStore((s) => s.savedWorkflowsError)
  const refreshSavedWorkflows = useWorkflowStore((s) => s.refreshSavedWorkflows)
  const loadSavedWorkflow     = useWorkflowStore((s) => s.loadSavedWorkflow)
  const textareaRef           = useRef<HTMLTextAreaElement>(null)

  const [showWorkflowsPanel, setShowWorkflowsPanel] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)

  // Loads the list once on mount so "Your workflows" has data without
  // requiring the user to open the My Workflows panel first
  useEffect(() => {
    refreshSavedWorkflows()
  }, [refreshSavedWorkflows])

  async function handleOpen(id: string) {
    setOpenError(null)
    try {
      await loadSavedWorkflow(id)
    } catch (err) {
      setOpenError(err instanceof Error ? err.message : 'Could not open workflow')
    }
  }

  function handlePlan() {
    if (!goal.trim()) return
    clearSidebarMessages()
    setScreen('chat')
  }

  function fillExample(text: string) {
    setGoal(text)
    textareaRef.current?.focus()
  }

  const hasSaved = savedWorkflows.length > 0

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* ── Top bar: brand + account only ── */}
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-[#e2e8f0]">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 bg-[#0f172a] rounded flex items-center justify-center text-white text-[11px] font-bold tracking-tight">
            A
          </div>
          <span className="text-[14px] font-semibold text-[#0f172a] tracking-tight">AgentMesh</span>
        </div>

        <button onClick={logout}
          className="px-3 py-1.5 rounded text-[13px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-colors">
          Log out
        </button>
      </header>

      <main className="flex-1 w-full max-w-[640px] mx-auto px-4 pt-16 pb-12">

        {/* ── Step 1 of the journey: describe ── */}
        <h1 className="text-[28px] sm:text-[32px] font-bold text-[#0f172a] leading-[1.15] tracking-[-0.5px] mb-3 text-center">
          What do you want to get done?
        </h1>
        <p className="text-[15px] text-[#64748b] mb-8 leading-[1.6] text-center">
          Describe a task. AgentMesh plans the steps, shows them to you, then runs them.
        </p>

        <div className="border border-[#e2e8f0] rounded-md bg-white shadow-sm
          focus-within:border-[#94a3b8] focus-within:shadow-[0_0_0_3px_rgba(148,163,184,.12)] transition-all">
          <label htmlFor="goal" className="sr-only">Describe your task</label>
          <textarea
            id="goal"
            ref={textareaRef}
            autoFocus
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePlan() } }}
            placeholder="e.g. Research the best budget laptops and write a short buying guide"
            rows={3}
            className="w-full bg-transparent text-[#0f172a] text-[15px] resize-none leading-[1.6] placeholder-[#94a3b8] outline-none px-4 pt-4"
          />
          <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-2 border-t border-[#f1f5f9]">
            <span className="hidden sm:inline text-[12px] text-[#94a3b8]">Enter to plan · Shift+Enter for a new line</span>
            <button
              onClick={handlePlan}
              disabled={!goal.trim()}
              className="ml-auto px-5 py-2 rounded text-[13px] font-semibold text-white bg-[#0f172a] hover:bg-[#1e293b] disabled:opacity-30 transition-colors">
              Plan the steps
            </button>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {EXAMPLES.map((text) => (
            <button
              key={text}
              onClick={() => fillExample(text)}
              className="px-3.5 py-1.5 rounded text-[12.5px] text-[#475569] border border-[#e2e8f0] bg-white
                hover:border-[#94a3b8] hover:text-[#0f172a] hover:bg-[#f8fafc] transition-all">
              {text}
            </button>
          ))}
        </div>

        {/* ── Below the input: saved workflows, or how it works for new users ── */}
        <section className="mt-14">
          {savedWorkflowsLoading && !hasSaved ? (
            <p className="text-[13px] text-[#94a3b8] text-center">Loading your workflows…</p>
          ) : savedWorkflowsError ? (
            <div role="alert" className="text-center">
              <p className="text-[13px] text-red-700 mb-3">{savedWorkflowsError}</p>
              <button
                onClick={refreshSavedWorkflows}
                className="px-3 py-1.5 rounded text-[12.5px] border border-[#e2e8f0] text-[#64748b] hover:border-[#94a3b8] hover:text-[#0f172a] transition-all">
                Try again
              </button>
            </div>
          ) : hasSaved ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[11px] font-semibold text-[#94a3b8] uppercase tracking-[.08em]">Your workflows</h2>
                {savedWorkflows.length > RECENT_LIMIT && (
                  <button onClick={() => setShowWorkflowsPanel(true)}
                    className="text-[12.5px] text-[#64748b] hover:text-[#0f172a] transition-colors">
                    View all →
                  </button>
                )}
              </div>
              <ul className="border border-[#e2e8f0] rounded divide-y divide-[#f1f5f9]">
                {savedWorkflows.slice(0, RECENT_LIMIT).map((wf) => (
                  <li key={wf.id}>
                    <button onClick={() => handleOpen(wf.id)}
                      className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-[#f8fafc] transition-colors">
                      <span className="text-[13.5px] text-[#0f172a] font-medium truncate">{wf.name}</span>
                      <span className="text-[12px] text-[#94a3b8] flex-shrink-0">Updated {formatUpdatedAt(wf.updated_at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {openError && (
                <p role="alert" className="mt-3 text-[12.5px] text-red-700">{openError}</p>
              )}
            </>
          ) : (
            <>
              <h2 className="text-[11px] font-semibold text-[#94a3b8] uppercase tracking-[.08em] mb-4 text-center">How it works</h2>
              <ol className="grid gap-3 sm:grid-cols-3">
                {HOW_IT_WORKS.map((step, i) => (
                  <li key={step.title} className="border border-[#e2e8f0] rounded px-4 py-3">
                    <div className="text-[11px] font-semibold text-[#94a3b8] mb-1">{i + 1}</div>
                    <p className="text-[13px] text-[#475569] leading-[1.55]">
                      <span className="font-semibold text-[#0f172a]">{step.title}</span> {step.text}
                    </p>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      </main>

      {showWorkflowsPanel && (
        <MyWorkflowsPanel onClose={() => setShowWorkflowsPanel(false)} />
      )}
    </div>
  )
}
