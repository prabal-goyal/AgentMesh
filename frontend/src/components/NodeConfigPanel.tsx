import { useWorkflowStore } from '../store/workflowStore'

const AVAILABLE_MODELS = [
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'anthropic/claude-sonnet-4-6',
  'anthropic/claude-haiku-4-5',
  'google/gemini-2.5-flash',
]

export function NodeConfigPanel() {
  const { nodes, selectedNodeId, updateNodeData, deleteNode } = useWorkflowStore()
  const node = nodes.find((n) => n.id === selectedNodeId)

  if (!node) return null

  const { data } = node

  return (
    <aside className="w-72 border-l bg-white flex flex-col shrink-0 overflow-y-auto">
      <div className="p-4 border-b flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Node Config
          </p>
          <p className="text-sm font-medium text-gray-700 mt-1 capitalize">
            {data.nodeType} node
          </p>
        </div>
        <button
          onClick={() => deleteNode(node.id)}
          className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors"
        >
          Delete
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Label */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Label</label>
          <input
            value={data.label}
            onChange={(e) => updateNodeData(node.id, { label: e.target.value })}
            className="border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        {/* Model picker */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Model</label>
          <select
            value={data.model}
            onChange={(e) => updateNodeData(node.id, { model: e.target.value })}
            className="border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* System prompt */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">System Prompt</label>
          <textarea
            value={data.systemPrompt}
            onChange={(e) => updateNodeData(node.id, { systemPrompt: e.target.value })}
            rows={6}
            className="border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        {/* Output preview — shown after execution */}
        {data.output && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Output</label>
            <div className="border border-gray-200 rounded-md px-3 py-2 text-xs text-gray-600 bg-gray-50 max-h-40 overflow-y-auto whitespace-pre-wrap">
              {data.output}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
