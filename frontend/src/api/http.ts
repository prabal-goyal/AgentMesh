// A 401 on a request that carried a token means the server no longer accepts
// it (expired, or signed with a different secret). The store registers a
// handler here instead of this file importing the store, which would make the
// two modules import each other.
let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

// For authenticated requests only. Login and signup must not use this: a
// wrong password also returns 401, and that should show an error, not log out.
export async function throwIfNotOk(res: Response) {
  if (res.ok) return

  if (res.status === 401) {
    onUnauthorized?.()
    throw new Error('Your session has expired. Please sign in again.')
  }

  const err = await res.json().catch(() => ({ error: 'Unknown error' }))
  throw new Error(err.error ?? `Server error ${res.status}`)
}
