import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { WorkflowNodeData } from '../../types/workflow'

// Color palette per node type
const STATUS_COLORS: Record<string, string> = {
  idle:    'bg-white border-gray-200',
  running: 'bg-blue-50 border-blue-400',
  done:    'bg-green-50 border-green-400',
  error:   'bg-red-50 border-red-400',
  skipped: 'bg-gray-50 border-gray-300 opacity-50',
}

const STATUS_DOT: Record<string, string> = {
  idle:    'bg-gray-300',
  running: 'bg-blue-400 animate-pulse',
  done:    'bg-green-400',
  error:   'bg-red-400',
  skipped: 'bg-gray-300',
}

interface BaseNodeProps extends NodeProps<Node<WorkflowNodeData>> {
  accentColor: string  // e.g. 'border-t-blue-500'
  icon: string         // emoji or short label
}

export function BaseNode({ data, selected, accentColor, icon }: BaseNodeProps) {
  const statusStyle = STATUS_COLORS[data.status] ?? STATUS_COLORS.idle
  const dotStyle    = STATUS_DOT[data.status]    ?? STATUS_DOT.idle

  return (
    <div
      className={`
        w-44 rounded-lg border-2 shadow-sm
        ${statusStyle}
        ${selected ? 'ring-2 ring-blue-400 ring-offset-1' : ''}
      `}
    >
      {/* Colored top bar acts as the node type indicator */}
      <div className={`h-1 rounded-t-md ${accentColor}`} />

      <div className="px-3 py-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-lg">{icon}</span>
          {/* Status dot */}
          <span className={`w-2 h-2 rounded-full ${dotStyle}`} />
        </div>
        <p className="text-sm font-medium text-gray-800 truncate">{data.label}</p>
        <p className="text-xs text-gray-400 truncate">{data.model}</p>
      </div>

      {/* Left handle = input (receives output from previous node) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !border-2 !border-white !bg-gray-400"
      />
      {/* Right handle = output (sends output to next node) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !border-2 !border-white !bg-gray-400"
      />
    </div>
  )
}
