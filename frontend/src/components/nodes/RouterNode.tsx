import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { WorkflowNodeData } from '../../types/workflow'

// Router nodes get an amber accent to visually distinguish them from AI nodes
const STATUS_COLORS: Record<string, string> = {
  idle:    'bg-white border-[#e2e8f0]',
  running: 'bg-amber-50 border-amber-400/70',
  done:    'bg-[#f0fdf4] border-green-400/60',
  error:   'bg-[#fef2f2] border-red-400/60',
  skipped: 'bg-white border-[#e2e8f0] opacity-40',
}

const STATUS_DOT: Record<string, string> = {
  idle:    'bg-[#cbd5e1]',
  running: 'bg-amber-500 animate-pulse',
  done:    'bg-green-500',
  error:   'bg-red-500',
  skipped: 'bg-[#cbd5e1]',
}

export function RouterNode({ data, selected }: NodeProps<Node<WorkflowNodeData>>) {
  const statusStyle = STATUS_COLORS[data.status] ?? STATUS_COLORS.idle
  const dotStyle    = STATUS_DOT[data.status]    ?? STATUS_DOT.idle

  return (
    <div
      className={`
        w-48 rounded border-2 shadow-sm
        ${statusStyle}
        ${selected ? 'ring-2 ring-amber-400/50 ring-offset-1 ring-offset-white' : ''}
      `}
    >
      {/* Amber accent bar marks this as a decision node */}
      <div className="h-[3px] rounded-t bg-amber-400" />

      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[.07em] text-[#94a3b8]">Router</span>
          <span className={`w-[7px] h-[7px] rounded-full ${dotStyle}`} />
        </div>

        <p className="text-[13px] font-semibold text-[#0f172a] truncate">{data.label}</p>
        <p className="text-[11px] text-[#94a3b8] truncate mt-[2px]">
          {data.condition || 'set condition…'}
        </p>

        {/* YES / NO labels — spaced to align with their handles */}
        <div className="flex flex-col items-end gap-2 mt-3">
          <span className="text-[11px] font-bold text-green-600 leading-none">YES</span>
          <span className="text-[11px] font-bold text-red-500 leading-none">NO</span>
        </div>
      </div>

      {/* Input handle on the left */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !border-2 !border-white !bg-[#94a3b8]"
      />

      {/* YES output — green handle, upper right.
          id="yes" becomes sourceHandle on the edge — the executor reads it for DAG pruning. */}
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
