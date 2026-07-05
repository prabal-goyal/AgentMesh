# AI Workflow Builder — Project Rules

This is a **learning project**. The goal is to understand concepts and architecture, not just ship working code. These rules apply to every session.

## Collaboration Rules

1. **Explain before code** — Before writing any file, explain what it does, why it exists in the architecture, and what concept it demonstrates. Wait for confirmation before proceeding.

2. **Concepts called out inline** — When hitting something non-obvious (topological sort, SSE, CORS, env vars, DAG execution, Zustand middleware, React Flow internals), pause and explain the concept in plain terms as a conversation checkpoint — not buried in a comment.

3. **No magic abstractions early** — Build things manually first before using shortcuts or helper libraries. Raw Express, raw fetch, raw SSE first so the user understands what's happening underneath.

4. **Strategic comments in code** — This project is an exception to the no-comments default. Add short "why" comments at non-obvious points, especially in backend files and AI/OpenRouter calls.

5. **One concept per phase** — Each phase has a primary learning goal. Don't mix Phase 3 concepts into Phase 2 even if it seems efficient.

6. **User verifies before proceeding** — At the end of each phase, the user runs it, sees it working in browser/terminal, confirms understanding, then we move to the next phase.

7. **Stop and ask anytime** — If something feels like a black box, unpack it fully before continuing. No skipping.

## User Background

- Comfortable with **React basics** (components, hooks, state)
- **New to backend** (Node.js, Express, APIs, env vars, CORS)
- **New to AI/LLM** concepts (Claude API, OpenRouter, multi-agent, SSE streaming)
- Explain **advanced React patterns** too (React Flow internals, complex Zustand, custom hooks) — don't assume knowledge beyond basic hooks/components

## Tech Stack (Verified Versions)

| Package | Version |
|---|---|
| react / react-dom | 19.2.7 |
| @xyflow/react | 12.11.1 |
| zustand | 5.0.14 |
| vite | 8.1.3 |
| @vitejs/plugin-react | 6.0.3 |
| tailwindcss / @tailwindcss/vite | 4.3.2 |
| typescript | 6.0.3 |
| express | 5.2.1 |
| openai (OpenRouter) | 6.45.0 |
| tsx | 4.23.0 |

## Repository

GitHub: https://github.com/prabal-goyal/AgentMesh
Remote: git@github.com:prabal-goyal/AgentMesh.git

## Architecture

```
frontend/   React app        → port 5173 (Vite dev server)
backend/    Express API      → port 3001 (tsx watch)
shared/     TypeScript types → used by both
```

API keys live only in `backend/.env` — never in frontend code.

## Model Strategy (OpenRouter)

| Node Role | Default Model |
|---|---|
| AI Planner | openai/gpt-4o |
| Research Node | google/gemini-2.5-flash |
| Writer Node | anthropic/claude-haiku-4-5 |
| Critic Node | openai/gpt-4o-mini |
| Complex Node | anthropic/claude-sonnet-4-6 |
| Custom Node | user-picked |

## Development Phases

- ✅ **Phase 1** — Project scaffold — pnpm workspaces, Vite + React 19, Express 5, git init, CLAUDE.md
- ✅ **Phase 2** — Canvas UI — React Flow canvas, 4 custom node types, Zustand store, config panel
- ✅ **Phase 3** — AI Planner — OpenRouter integration, POST /api/plan, PlannerInput UI
- ✅ **Phase 4** — Execution Engine — topological sort (Kahn's), sequential node runner, context chaining
- ✅ **Phase 5** — Real-time Streaming — SSE endpoint, fetch ReadableStream, per-token canvas updates
- 🔲 **Phase 6** — Inspection + Editing (retry, inline edit) ← **NEXT**
- 🔲 **Phase 5** — Real-time Streaming (SSE)
- 🔲 **Phase 6** — Inspection + Editing (retry, inline edit)
- 🔲 **Phase 7** — Tavily web search integration for Research nodes (RAG pattern)

## Session Resume Instructions

When resuming: greet the user, confirm which phase is next (shown above), briefly recap what was built last, and ask if they're ready to continue or have questions first. Do NOT restart from scratch or re-explain Phase 1.
