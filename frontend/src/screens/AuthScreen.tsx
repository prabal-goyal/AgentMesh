import { useState } from 'react'
import { useWorkflowStore } from '../store/workflowStore'

type Mode = 'login' | 'signup'

// Rendered instead of the normal screen switch whenever there's no logged-in
// user — see App.tsx. Unlike the old AuthModal this replaces, there's no
// backdrop or close button: with login mandatory, there's nothing "behind"
// it to dismiss back to.
export function AuthScreen() {
  const login          = useWorkflowStore((s) => s.login)
  const signup          = useWorkflowStore((s) => s.signup)
  const authError       = useWorkflowStore((s) => s.authError)
  const clearAuthError  = useWorkflowStore((s) => s.clearAuthError)

  const [mode, setMode]         = useState<Mode>('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (mode === 'signup') {
        await signup(email, password)
      } else {
        await login(email, password)
      }
    } catch {
      // authError is already set in the store — nothing more to do here
    } finally {
      setSubmitting(false)
    }
  }

  function switchTo(next: Mode) {
    clearAuthError()
    setMode(next)
  }

  return (
    <div className="h-screen bg-white flex flex-col items-center justify-center px-4">
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-6 h-6 bg-[#0f172a] rounded flex items-center justify-center text-white text-[11px] font-bold tracking-tight">
          A
        </div>
        <span className="text-[14px] font-semibold text-[#0f172a] tracking-tight">AgentMesh</span>
      </div>

      <div className="w-full max-w-[380px] bg-white rounded-md shadow-sm border border-[#e2e8f0] p-6">
        <h2 className="text-[17px] font-semibold text-[#0f172a] tracking-tight mb-5">
          {mode === 'signup' ? 'Create an account' : 'Log in'}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-[#475569]">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="px-3 py-2 rounded border border-[#e2e8f0] text-[14px] text-[#0f172a] outline-none
                focus:border-[#94a3b8] focus:shadow-[0_0_0_3px_rgba(148,163,184,.12)] transition-all"
              placeholder="you@example.com"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-[#475569]">Password</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="px-3 py-2 rounded border border-[#e2e8f0] text-[14px] text-[#0f172a] outline-none
                focus:border-[#94a3b8] focus:shadow-[0_0_0_3px_rgba(148,163,184,.12)] transition-all"
              placeholder="At least 8 characters"
            />
          </label>

          {authError && (
            <p className="text-[12.5px] text-red-600">{authError}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 px-4 py-2 rounded text-[13.5px] font-semibold text-white bg-[#0f172a]
              hover:bg-[#1e293b] disabled:opacity-40 transition-colors"
          >
            {submitting ? 'Please wait…' : mode === 'signup' ? 'Sign up' : 'Log in'}
          </button>
        </form>

        <p className="text-[12.5px] text-[#64748b] text-center mt-4">
          {mode === 'signup' ? (
            <>Already have an account?{' '}
              <button onClick={() => switchTo('login')} className="text-[#0f172a] font-medium hover:underline">
                Log in
              </button>
            </>
          ) : (
            <>Don't have an account?{' '}
              <button onClick={() => switchTo('signup')} className="text-[#0f172a] font-medium hover:underline">
                Sign up
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
