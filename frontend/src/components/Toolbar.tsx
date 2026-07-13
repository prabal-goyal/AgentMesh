import { useWorkflowStore } from '../store/workflowStore'
import type { NodeType } from '../types/workflow'

const NODE_BUTTONS: { type: NodeType; label: string; icon: string; color: string }[] = [
  { type: 'research',    label: 'Research', icon: '🔍', color: 'hover:bg-blue-50 hover:border-blue-300' },
  { type: 'writer',      label: 'Writer',   icon: '✍️', color: 'hover:bg-green-50 hover:border-green-300' },
  { type: 'critic',      label: 'Critic',   icon: '🔎', color: 'hover:bg-amber-50 hover:border-amber-300' },
  { type: 'custom',      label: 'Custom',   icon: '⚙️', color: 'hover:bg-purple-50 hover:border-purple-300' },
  { type: 'conditional', label: 'Router',   icon: '🔀', color: 'hover:bg-yellow-50 hover:border-yellow-300' },
]

export function Toolbar() {
  const addNode = useWorkflowStore((state) => state.addNode)

  return (
    <aside className="w-48 border-r bg-white flex flex-col gap-2 p-3 shrink-0">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
        Add Node
      </p>
      {NODE_BUTTONS.map(({ type, label, icon, color }) => (
        <button
          key={type}
          onClick={() => addNode(type)}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200
            text-sm text-gray-700 text-left transition-colors cursor-pointer
            ${color}
          `}
        >
          <span>{icon}</span>
          {label}
        </button>
      ))}
    </aside>
  )
}
