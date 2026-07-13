import { useEffect } from 'react'
import { useWorkflowStore } from '../store/workflowStore'

const NODE_TYPE_COLOR: Record<string, string> = {
  research:    '#2563eb',
  writer:      '#7c3aed',
  critic:      '#0f766e',
  custom:      '#475569',
  conditional: '#ca8a04',
}

export function GeneratingScreen() {
  const setScreen = useWorkflowStore((s) => s.setScreen)
  const nodes     = useWorkflowStore((s) => s.nodes)

  // Auto-advance to builder after the animation plays through all nodes
  useEffect(() => {
    const delay = Math.max(2600, nodes.length * 400 + 600)
    const timer = setTimeout(() => setScreen('builder'), delay)
    return () => clearTimeout(timer)
  }, [setScreen, nodes.length])

  return (
    <div className="h-screen bg-white flex flex-col items-center justify-center text-center px-6">
      {/* Animated ring — replaces emoji orb */}
      <div className="w-16 h-16 rounded-full border-2 border-[#e2e8f0] border-t-[#0f172a] mb-8"
        style={{ animation: 'spin 1.1s linear infinite' }} />

      <div className="text-[22px] font-bold text-[#0f172a] mb-2">Building your workflow</div>
      <div className="text-[14px] text-[#64748b] mb-10">
        Setting up {nodes.length} agent{nodes.length !== 1 ? 's' : ''} and connecting them
      </div>

      {/* Node steps animate in one at a time */}
      <div className="flex flex-col gap-2 w-full max-w-[400px]">
        {nodes.map((n, i) => (
          <div
            key={n.id}
            className="flex items-center gap-3 px-4 py-3 rounded bg-[#f8fafc] border border-[#e2e8f0]"
            style={{ animation: 'stepIn 0.4s ease forwards', animationDelay: `${i * 0.35}s`, opacity: 0 }}>
            {/* Colored type indicator bar */}
            <div className="w-0.5 h-5 rounded-full flex-shrink-0"
              style={{ background: NODE_TYPE_COLOR[n.data.nodeType] ?? '#475569' }} />
            <span className="text-[13px] text-[#64748b] flex-1 text-left">
              Creating <span className="text-[#0f172a] font-semibold">{n.data.label}</span>
            </span>
            <span
              className="text-green-600 text-[12px] font-bold"
              style={{ animation: 'stepIn 0.3s ease forwards', animationDelay: `${i * 0.35 + 0.3}s`, opacity: 0 }}>
              Done
            </span>
          </div>
        ))}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
