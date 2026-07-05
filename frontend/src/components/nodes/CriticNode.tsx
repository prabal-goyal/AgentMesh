import type { NodeProps, Node } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import type { WorkflowNodeData } from '../../types/workflow'

export function CriticNode(props: NodeProps<Node<WorkflowNodeData>>) {
  return <BaseNode {...props} accentColor="bg-amber-500" icon="🔎" />
}
