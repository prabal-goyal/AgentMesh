# AgentMesh — Project Rules

AgentMesh is an AI workflow builder for **non-technical users**: describe a goal,
an AI planner lays out a graph of AI nodes (research, write, critique, route),
and the graph runs with live streaming output on a canvas.

This is a **learning project**. The goal is to understand concepts and
architecture, not just ship working code. These rules apply to every session.

Everything needed to work on the project lives in this repository:
- `CLAUDE.md` — how we work (this file)
- `ROADMAP.md` — scope, phase status, open issues (read it at session start)
- `README.md` — setup, environment variables, commands, deployment
- `.claude/commands/` — the `/pm` and `/pa` slash commands

## Product Principles

1. **One journey** — describe a goal → check the steps → run. Don't add a second way
   in (templates, blank canvas on the home screen, shortcuts that skip a step). Every
   extra choice on the main path is friction for a non-technical user.
2. **No dead controls** — a button or input that does nothing is removed, not left as
   a placeholder for a future feature.
3. **Plain language in the UI** — no developer words (agents, nodes, canvas, workflow
   graph, model IDs) where a user would describe it differently.
4. **Never fail silently** — every failed action tells the user what happened.

## Project Boundary Rules

These override everything else and apply to every session.

1. **No files outside the repository** — Never create, edit, delete, or copy
   files outside the repository root (the directory containing this file).
   That includes user-level Claude config and memory folders.
2. **Commands live here** — Slash commands go in `.claude/commands/`. Never
   install them globally.
3. **Settings stay local** — Use `.claude/settings.local.json` for permissions.
   Never modify user-level settings.
4. **No global package installs** — Use `pnpm`, scoped to this workspace. Never
   `npm install -g` or `pnpm add -g`.
5. **Git operations target this repo only.**
6. **If a task requires touching something outside this folder, stop and ask first.**

## Secrets and Git

1. **Never read `.env` files** (or any file holding credentials), even to verify
   something the user asked to verify. If a task needs a secret value, ask the
   user to paste it. The user wants explicit control over when secrets pass
   through the assistant's context. `.env.example` is fine to read.
2. **Never commit or push without being asked.** Never force push or rewrite history.
3. **Use pnpm**, never npm.

## Collaboration Rules

1. **Explain before code** — Before writing any file, explain what it does, why
   it exists in the architecture, and what concept it demonstrates. Wait for
   confirmation before proceeding.
2. **Concepts called out inline** — When hitting something non-obvious
   (topological sort, SSE, CORS, env vars, DAG execution, Zustand middleware,
   React Flow internals), pause and explain the concept in plain terms as a
   conversation checkpoint — not buried in a comment.
3. **No magic abstractions early** — Build things manually first before using
   shortcuts or helper libraries. Raw Express, raw fetch, raw SSE first so the
   user understands what's happening underneath.
4. **Strategic comments in code** — This project is an exception to the
   no-comments default. Add short "why" comments at non-obvious points,
   especially in backend files and AI provider calls.
5. **One concept per phase** — Each phase has a primary learning goal. Don't mix
   a later phase's concepts into the current one even if it seems efficient.
6. **User verifies before proceeding** — At the end of each phase, the user runs
   it, sees it working in browser/terminal, confirms understanding, then we move on.
7. **Stop and ask anytime** — If something feels like a black box, unpack it
   fully before continuing. No skipping.

## Answer-Quality Rules

1. **Present interpretations, don't pick silently** — When a request has
   multiple reasonable readings, list them and ask which one.
2. **The overcomplication gut-check** — Before calling code done, ask "would a
   senior engineer call this overcomplicated?" No abstractions, flexibility, or
   config for a single call site that wasn't asked for.
3. **Surgical diffs** — Don't reformat or "improve" adjacent code/comments while
   making a change. Match existing style. Mention unrelated dead code you
   notice — don't delete it. Only remove imports/variables your own change made unused.
4. **State a step → verify plan for multi-step work** — Before executing, write
   out steps with what verifies each one (build/lint passes, tests pass, user
   confirms in browser, endpoint returns expected response).

## User Background

- Comfortable with **React basics** (components, hooks, state)
- **New to backend** (Node.js, Express, APIs, env vars, CORS)
- **New to AI/LLM** concepts (OpenRouter, multi-agent, SSE streaming)
- Explain **advanced React patterns** too (React Flow internals, complex
  Zustand, custom hooks) — don't assume knowledge beyond basic hooks/components

## Architecture

```
frontend/   React 19 + Vite + React Flow + Zustand + Tailwind  → port 5173
backend/    Express 5 API (tsx), Postgres via raw `pg`          → port 3001
```

- API keys live only in `backend/.env` — never in frontend code.
- The frontend reaches the backend through `VITE_API_URL` (defaults to `http://localhost:3001`).
- Key backend modules: `lib/executor.ts` (wave-based topological execution,
  deliberately free of database imports so it stays unit-testable),
  `lib/openrouter.ts` (provider routing: `openai/*` direct to OpenAI, everything
  else via OpenRouter), `lib/validation.ts` (zod schemas at the trust boundary),
  `db/runs.ts` (run + per-node cost/latency persistence).

## Tech Stack

| Package | Version |
|---|---|
| react / react-dom | 19.2 |
| @xyflow/react | 12.11 |
| zustand | 5.0 |
| vite | 8.1 |
| tailwindcss | 4.3 |
| typescript | 6.0 |
| express | 5.2 |
| openai (SDK, also used for OpenRouter) | 6.45 |
| pg | 8.23 |
| zod | 4.6 |
| vitest | 5.0 |

`package.json` files are the source of truth if this table drifts.

## Model Strategy (OpenRouter)

| Node Role | Default Model |
|---|---|
| AI Planner | openai/gpt-4o |
| Research Node | google/gemini-2.5-flash |
| Writer Node | anthropic/claude-haiku-4-5 |
| Critic Node | openai/gpt-4o-mini |
| Complex Node | anthropic/claude-sonnet-4-6 |
| Custom Node | user-picked |

## Session Resume Instructions

When resuming: read `ROADMAP.md`, greet the user, confirm what is next, briefly
recap what was built last, and ask if they're ready to continue or have
questions first. Do NOT restart from scratch or re-explain earlier phases.
