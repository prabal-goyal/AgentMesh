import { useEffect } from 'react'
import { useWorkflowStore } from '../store/workflowStore'

interface MyWorkflowsPanelProps {
  onClose: () => void
}

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export function MyWorkflowsPanel({ onClose }: MyWorkflowsPanelProps) {
  const savedWorkflows        = useWorkflowStore((s) => s.savedWorkflows)
  const savedWorkflowsLoading = useWorkflowStore((s) => s.savedWorkflowsLoading)
  const refreshSavedWorkflows = useWorkflowStore((s) => s.refreshSavedWorkflows)
  const loadSavedWorkflow     = useWorkflowStore((s) => s.loadSavedWorkflow)
  const deleteSavedWorkflow   = useWorkflowStore((s) => s.deleteSavedWorkflow)

  useEffect(() => {
    refreshSavedWorkflows()
  }, [refreshSavedWorkflows])

  async function handleOpen(id: string) {
    await loadSavedWorkflow(id)
    onClose()
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return
    await deleteSavedWorkflow(id)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-[480px] max-h-[70vh] bg-white rounded-md shadow-xl border border-[#e2e8f0] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e8f0] flex-shrink-0">
          <h2 className="text-[15px] font-semibold text-[#0f172a] tracking-tight">My Workflows</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded text-[#94a3b8] hover:text-[#0f172a] hover:bg-[#f1f5f9] transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {savedWorkflowsLoading ? (
            <p className="text-[13px] text-[#94a3b8] text-center py-8">Loading…</p>
          ) : savedWorkflows.length === 0 ? (
            <p className="text-[13px] text-[#94a3b8] text-center py-8">
              No saved workflows yet — build one and hit Save.
            </p>
          ) : (
            savedWorkflows.map((wf) => (
              <div
                key={wf.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded hover:bg-[#f8fafc] transition-colors"
              >
                <button
                  onClick={() => handleOpen(wf.id)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-[13.5px] text-[#0f172a] font-medium truncate">{wf.name}</p>
                  <p className="text-[11.5px] text-[#94a3b8]">Updated {formatUpdatedAt(wf.updated_at)}</p>
                </button>
                <button
                  onClick={() => handleDelete(wf.id, wf.name)}
                  className="text-[12px] text-[#94a3b8] hover:text-red-600 px-2 py-1 rounded transition-colors flex-shrink-0"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
