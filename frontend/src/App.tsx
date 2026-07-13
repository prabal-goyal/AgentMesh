import { useState, useEffect }  from 'react'
import { useWorkflowStore, type AppScreen } from './store/workflowStore'
import { HomeScreen }       from './screens/HomeScreen'
import { ChatScreen }       from './screens/ChatScreen'
import { GeneratingScreen } from './screens/GeneratingScreen'
import { BuilderScreen }    from './screens/BuilderScreen'
import { ResultsScreen }    from './screens/ResultsScreen'

// builder and running both render BuilderScreen — no remount needed between them
const isBuilderGroup = (s: AppScreen) => s === 'builder' || s === 'running'

function App() {
  const screen = useWorkflowStore((s) => s.screen)

  // 'displayed' is what's actually rendered — it lags one tick behind 'screen'
  // so we can fade the old content out before swapping in the new content
  const [displayed, setDisplayed] = useState<AppScreen>(screen)
  const [opacity,   setOpacity]   = useState(1)

  useEffect(() => {
    if (screen === displayed) return

    // Builder ↔ Running use the same component — skip the crossfade
    // (the sidebar just changes internally, no visible discontinuity)
    if (isBuilderGroup(screen) && isBuilderGroup(displayed)) {
      setDisplayed(screen)
      return
    }

    // All other transitions: fade out → swap → fade in
    setOpacity(0)
    const t = setTimeout(() => {
      setDisplayed(screen)
      setOpacity(1)
    }, 210)
    return () => clearTimeout(t)
  }, [screen, displayed])

  return (
    <div
      style={{
        height: '100vh',
        opacity,
        transition: 'opacity 0.21s ease',
        // Block clicks while fading so nothing fires during the transition
        pointerEvents: opacity < 1 ? 'none' : undefined,
      }}
    >
      {displayed === 'home'                     && <HomeScreen />}
      {displayed === 'chat'                     && <ChatScreen />}
      {displayed === 'generating'               && <GeneratingScreen />}
      {isBuilderGroup(displayed)                && <BuilderScreen />}
      {displayed === 'results'                  && <ResultsScreen />}
    </div>
  )
}

export default App
