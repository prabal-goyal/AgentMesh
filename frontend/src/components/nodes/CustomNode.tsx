import type { NodeProps, Node } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import type { WorkflowNodeData } from '../../types/workflow'

export function CustomNode(props: NodeProps<Node<WorkflowNodeData>>) {
  return <BaseNode {...props} accentColor="bg-purple-500" icon="⚙️" />
}
