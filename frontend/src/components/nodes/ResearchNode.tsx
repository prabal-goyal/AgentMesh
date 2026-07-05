import type { NodeProps, Node } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import type { WorkflowNodeData } from '../../types/workflow'

export function ResearchNode(props: NodeProps<Node<WorkflowNodeData>>) {
  return <BaseNode {...props} accentColor="bg-blue-500" icon="🔍" />
}
