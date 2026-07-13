import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { WorkflowNodeData } from '../../types/workflow'

// Router nodes use yellow to visually distinguish them from AI-running nodes
const STATUS_COLORS: Record<string, string> = {
  idle:    'bg-white border-gray-200',
  running: 'bg-yellow-50 border-yellow-400',
  done:    'bg-green-50 border-green-300',
  error:   'bg-red-50 border-red-400',
  skipped: 'bg-gray-50 border-gray-300 opacity-50',
}

const STATUS_DOT: Record<string, string> = {
  idle:    'bg-gray-300',
  running: 'bg-yellow-400 animate-pulse',
  done:    'bg-green-400',
  error:   'bg-red-400',
  skipped: 'bg-gray-300',
}

export function RouterNode({ data, selected }: NodeProps<Node<WorkflowNodeData>>) {
  const statusStyle = STATUS_COLORS[data.status] ?? STATUS_COLORS.idle
  const dotStyle    = STATUS_DOT[data.status]    ?? STATUS_DOT.idle

  return (
    <div
      className={`
        w-48 rounded-lg border-2 shadow-sm
        ${statusStyle}
        ${selected ? 'ring-2 ring-yellow-400 ring-offset-1' : ''}
      `}
    >
      {/* Yellow accent bar marks this as a decision node, not an AI node */}
      <div className="h-1 rounded-t-md bg-yellow-400" />

      <div className="px-3 py-2">
        {/* Icon + status dot */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-lg">🔀</span>
          <span className={`w-2 h-2 rounded-full ${dotStyle}`} />
        </div>

        <p className="text-sm font-medium text-gray-800 truncate">{data.label}</p>
        <p className="text-xs text-gray-400 truncate mt-0.5">
          {data.condition || 'set condition…'}
        </p>

        {/* YES / NO labels — vertically spaced to align with their handles */}
        <div className="flex flex-col items-end gap-2 mt-3">
          <span className="text-[11px] font-bold text-green-600 leading-none">YES</span>
          <span className="text-[11px] font-bold text-red-500 leading-none">NO</span>
        </div>
      </div>

      {/* Input: single handle on the left */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !border-2 !border-white !bg-gray-400"
      />

      {/* YES output — green handle, upper right.
          The id="yes" becomes sourceHandle on the edge when the user drags from here.
          The executor reads sourceHandle to know which branch to prune. */}
      <Handle
        type="source"
        position={Position.Right}
        id="yes"
        style={{ top: '68%' }}
        className="!w-3 !h-3 !border-2 !border-white !bg-green-500"
      />

      {/* NO output — red handle, lower right */}
      <Handle
        type="source"
        position={Position.Right}
        id="no"
        style={{ top: '85%' }}
        className="!w-3 !h-3 !border-2 !border-white !bg-red-400"
      />
    </div>
  )
}
