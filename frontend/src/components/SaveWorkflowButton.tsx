import { useState } from 'react'
import { useWorkflowStore } from '../store/workflowStore'

// Self-contained: owns its own popover open/name/error state and calls
// straight into the store's saveCurrentWorkflow action. Nothing else in the
// app needs to know a save is in progress, so this doesn't touch global state
// beyond what the store action itself sets.
export function SaveWorkflowButton() {
  const currentWorkflowName = useWorkflowStore((s) => s.currentWorkflowName)
  const goal                = useWorkflowStore((s) => s.goal)
  const nodes                = useWorkflowStore((s) => s.nodes)
  const saveCurrentWorkflow = useWorkflowStore((s) => s.saveCurrentWorkflow)

  const [open, setOpen]           = useState(false)
  const [name, setName]           = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  function openPopover() {
    setName(currentWorkflowName ?? goal ?? '')
    setError(null)
    setOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await saveCurrentWorkflow(name.trim())
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={openPopover}
        disabled={nodes.length === 0}
        className="px-3 py-1.5 rounded text-[13px] border border-[#e2e8f0] text-[#64748b] hover:border-[#94a3b8] hover:text-[#0f172a] disabled:opacity-40 transition-all">
        Save
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-[260px] bg-white rounded-md shadow-lg border border-[#e2e8f0] p-4 z-20">
          <p className="text-[12.5px] font-semibold text-[#0f172a] mb-2.5">Save workflow</p>
          <form onSubmit={handleSave} className="flex flex-col gap-2.5">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workflow name"
              className="px-3 py-2 rounded border border-[#e2e8f0] text-[13.5px] text-[#0f172a] outline-none
                focus:border-[#94a3b8] focus:shadow-[0_0_0_3px_rgba(148,163,184,.12)] transition-all"
            />
            {error && <p className="text-[12px] text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 rounded text-[12.5px] text-[#64748b] hover:bg-[#f1f5f9] transition-colors">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="px-3 py-1.5 rounded text-[12.5px] font-semibold text-white bg-[#0f172a] hover:bg-[#1e293b] disabled:opacity-40 transition-colors">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
