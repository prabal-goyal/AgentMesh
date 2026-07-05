import { Canvas } from './components/Canvas'
import { Toolbar } from './components/Toolbar'
import { NodeConfigPanel } from './components/NodeConfigPanel'
import { useWorkflowStore } from './store/workflowStore'

function App() {
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId)

  return (
    <div className="flex h-screen bg-gray-50">
      <Toolbar />
      <main className="flex-1 overflow-hidden">
        <Canvas />
      </main>
      {/* Panel only renders when a node is selected */}
      {selectedNodeId && <NodeConfigPanel />}
    </div>
  )
}

export default App
