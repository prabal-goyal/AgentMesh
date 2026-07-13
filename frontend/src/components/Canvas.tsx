import { ReactFlow, Background, Controls, BackgroundVariant } from '@xyflow/react'
import { useWorkflowStore } from '../store/workflowStore'
import { ResearchNode } from './nodes/ResearchNode'
import { WriterNode } from './nodes/WriterNode'
import { CriticNode } from './nodes/CriticNode'
import { CustomNode } from './nodes/CustomNode'
import { RouterNode } from './nodes/RouterNode'

// Defined OUTSIDE the component — if this were inside, React Flow would
// see a new object on every render and remount every node (causes flicker)
const nodeTypes = {
  research:    ResearchNode,
  writer:      WriterNode,
  critic:      CriticNode,
  custom:      CustomNode,
  conditional: RouterNode,
}

export function Canvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, selectNode } =
    useWorkflowStore()

  return (
    // React Flow needs an explicit height on its container
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => selectNode(node.id)}
        onPaneClick={() => selectNode(null)}
        fitView
        className="bg-gray-50"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d1d5db" />
        <Controls />
      </ReactFlow>
    </div>
  )
}
