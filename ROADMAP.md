# AgentMesh Roadmap

**Scope:** an AI workflow builder that non-technical users can use without help.
The current goal is **readiness for basic user testing**: finish Phase 11, then
Phases 12–16. Deferred features wait until real users have tested the product.

This file is the single source of truth for project status. `/pm` keeps it up to
date. Mark a phase done only after the user has confirmed it works.

Status legend: ✅ done · 🟡 in progress · 🔲 not started

## Done

- ✅ **Phase 1** — Project scaffold: pnpm workspaces, Vite + React 19, Express 5
- ✅ **Phase 2** — Canvas UI: React Flow canvas, custom node types, Zustand store, config panel
- ✅ **Phase 3** — AI Planner: OpenRouter integration, `POST /api/plan`, planner input UI
- ✅ **Phase 4** — Execution engine: topological sort (Kahn's), node runner, context chaining
- ✅ **Phase 5** — Real-time streaming: SSE endpoint, fetch ReadableStream, per-token canvas updates
- ✅ **Phase 6** — Inspection + editing: retry single node, copy output, auto-scroll, reset
- ✅ **Phase 7** — Tavily web search: tool-use loop for Research nodes (up to 3 search rounds)
- ✅ **Phase 8** — Router node: yes/no branching, DAG pruning, skipped status, planner-aware
- ✅ **Phase 9** — Parallel execution: wave-based topo sort, `Promise.allSettled` per wave
- ✅ **Phase 10** — Run history + cost tracker: token counts, cost per model, history sidebar
- ✅ **Hardening pass** — auth + per-user quotas on every AI endpoint, zod validation and
  model allowlist, cycle rejection, provider timeouts and stall detection, runs and
  per-node cost/latency persisted to Postgres, vitest suite + CI, planner eval harness

## Next

- 🟡 **Phase 11** — Authentication + Save/Load + Templates
  - ✅ Neon Postgres, `users` table, signup/login, bcrypt, JWT (Bearer token in `localStorage`)
  - ✅ `workflows` table scoped per user, Save button, "My Workflows" list
  - 🔲 3 built-in templates (blog writer, research report, code reviewer) — the
    "Templates" / "Browse Templates" buttons on the home screen do nothing yet
  - 🔲 Results screen shows every node's output, not just the final one

## Planned

- 🔲 **Phase 12** — Variable injection: `{{topic}}`, `{{tone}}` placeholders, form before each run
- 🔲 **Phase 13** — File upload node: drop in a PDF/text file, its content feeds downstream nodes
- 🔲 **Phase 14** — Auto-retry: a failed node retries once before being marked as an error
  (provider-level retries already exist in the OpenAI SDK; this is node-level)
- 🔲 **Phase 15** — Share via link: workflow encoded in a URL; recipient can run but not edit
- 🔲 **Phase 16** — SSO: Google (optionally GitHub) sign-in via OAuth + PKCE, `oauth_accounts`
  table, nullable `users.password_hash`; revisit email verification and password reset

## Deferred (revisit after user testing)

- Human-in-the-loop — pause mid-run for user review
- Fallback node — route to a backup node after retry failure (needs Phase 14)
- Email output node — send the final output to an inbox
- Scheduled runs — run a workflow on a timer

## Open Issues

- An expired or invalid login shows an error message instead of returning to the login screen.
- `requireAuth` does not check that the user still exists in Postgres.
- The run quota is in memory, so it resets on restart and counts per server instance.
- Router nodes make no AI call, so they leave gaps in per-node run history.
  Decision needed: record them at cost 0, or keep the table about AI calls only?
- `anthropic/claude-sonnet-4-6` prices in `MODEL_PRICING` have not been checked against OpenRouter.
