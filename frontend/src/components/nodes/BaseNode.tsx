import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { WorkflowNodeData } from '../../types/workflow'

// Light-themed status colors
const STATUS_COLORS: Record<string, string> = {
  idle:    'bg-white border-[#e2e8f0]',
  running: 'bg-[#eff6ff] border-blue-400/70',
  done:    'bg-[#f0fdf4] border-green-400/60',
  error:   'bg-[#fef2f2] border-red-400/60',
  skipped: 'bg-white border-[#e2e8f0] opacity-40',
}

const STATUS_DOT: Record<string, string> = {
  idle:    'bg-[#cbd5e1]',
  running: 'bg-blue-500 animate-pulse',
  done:    'bg-green-500',
  error:   'bg-red-500',
  skipped: 'bg-[#cbd5e1]',
}

interface BaseNodeProps extends NodeProps<Node<WorkflowNodeData>> {
  accentColor: string  // e.g. 'bg-blue-500'
}

export function BaseNode({ data, selected, accentColor }: BaseNodeProps) {
  const statusStyle = STATUS_COLORS[data.status] ?? STATUS_COLORS.idle
  const dotStyle    = STATUS_DOT[data.status]    ?? STATUS_DOT.idle

  return (
    <div
      className={`
        w-44 rounded border-2 shadow-sm
        ${statusStyle}
        ${selected ? 'ring-2 ring-[#4f46e5]/50 ring-offset-1 ring-offset-white' : ''}
      `}
    >
      {/* Colored top bar — indicates node type at a glance */}
      <div className={`h-[3px] rounded-t ${accentColor}`} />

      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[.07em] text-[#94a3b8]">
            {data.nodeType}
          </span>
          <span className={`w-[7px] h-[7px] rounded-full ${dotStyle}`} />
        </div>
        <p className="text-[13px] font-semibold text-[#0f172a] truncate">{data.label}</p>
        <p className="text-[11px] text-[#94a3b8] truncate mt-[2px]">{data.model}</p>
      </div>

      {/* Left handle = input */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !border-2 !border-white !bg-[#94a3b8]"
      />
      {/* Right handle = output */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !border-2 !border-white !bg-[#94a3b8]"
      />
    </div>
  )
}
