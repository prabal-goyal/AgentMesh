import { Canvas } from './components/Canvas'
import { Toolbar } from './components/Toolbar'
import { NodeConfigPanel } from './components/NodeConfigPanel'
import { PlannerInput } from './components/PlannerInput'
import { useWorkflowStore } from './store/workflowStore'

function App() {
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId)

  return (
    // flex-col stacks the header above the canvas row
    <div className="flex flex-col h-screen bg-gray-50">
      <PlannerInput />

      {/* flex-1 makes this row take all remaining height below the header */}
      <div className="flex flex-1 overflow-hidden">
        <Toolbar />
        <main className="flex-1 overflow-hidden">
          <Canvas />
        </main>
        {selectedNodeId && <NodeConfigPanel />}
      </div>
    </div>
  )
}

export default App
