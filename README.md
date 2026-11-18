# AgentMesh

A visual workflow builder for AI agents. Type a goal; an LLM plans it as a graph of agents
(research, writer, critic, router, custom). The backend validates the graph, runs independent
steps in parallel and streams every token to the canvas.

**Live:** https://agent-mesh-frontend-six.vercel.app

| | |
|---|---|
| **Planning** | The planner returns a graph as structured JSON; the server repairs missing models and rejects anything that is not a valid DAG |
| **Execution** | Topological sort in waves (Kahn's algorithm); each wave runs concurrently with `Promise.allSettled`. Router nodes branch yes/no and prune the skipped path |
| **Streaming** | Server-Sent Events: per-node tokens, tool calls and status, rendered live on a React Flow canvas |
| **Tools** | Research nodes run a web-search tool loop (Tavily) |
| **Models** | Several providers through OpenRouter (OpenAI, Google, Anthropic); model allowlist with per-model pricing |
| **Guardrails** | JWT auth on every inference route, per-user run quotas, zod validation at the API boundary, limits on graph size and prompt length, timeouts and retries with backoff on 429/5xx |
| **Observability** | Every run and node is stored in Postgres with tokens, cost, time to first token and duration |

## Measured

- **Planner reliability, 53% → 100%.** A 15-goal eval (`pnpm --filter backend eval:planner`)
  checks that each plan parses, uses valid node types and allowed models, is acyclic and stays
  within size limits. The first run found the planner omitting models on 7 of 15 goals; a
  server-side fix took it to 15 of 15.
- **Parallel execution, 2.2x faster.** On a 4-node graph (one node, then three in parallel), median
  wall-clock went from 4,954 ms sequential to 2,239 ms (`pnpm --filter backend bench:parallel`).
- **117 tests** (vitest) on graph scheduling, condition parsing, cost maths, request validation,
  quotas and streaming, plus type checks, in CI on every push.

## Architecture

```
frontend/   React 19, Vite, React Flow, Zustand, Tailwind     (Vercel)
backend/    Express 5, TypeScript, Postgres via pg, zod        (Render)
```

API keys live only in the backend. The frontend talks to it through `VITE_API_URL`.

## Run locally

Requires Node 22, pnpm and a Postgres database (for example Neon).

```bash
pnpm install
cp backend/.env.example backend/.env     # OpenRouter, Tavily, DATABASE_URL, JWT_SECRET
pnpm --filter backend db:migrate
pnpm dev                                 # frontend on :5173, backend on :3001
```

Checks:

```bash
pnpm --filter backend typecheck
pnpm --filter backend test
```

The planner eval and the parallel benchmark call real models and cost money, so they are not
part of CI.
