# AgentMesh

An AI workflow builder for non-technical users. Describe a goal, an AI planner
lays out a graph of AI nodes (research, write, critique, route), and the graph
runs with live streaming output on a canvas.

- Project rules: [`CLAUDE.md`](CLAUDE.md)
- Scope and status: [`ROADMAP.md`](ROADMAP.md)

## Prerequisites

- Node.js 22
- pnpm (the version is pinned in the root `package.json` `packageManager` field;
  `corepack enable` will pick it up)
- A Postgres database (the deployed app uses Neon)
- API keys: OpenAI, OpenRouter, Tavily

## Setup

```sh
pnpm install
cp backend/.env.example backend/.env   # then fill in real values
pnpm --filter backend db:migrate       # creates the tables from backend/src/db/schema.sql
```

### Backend environment variables (`backend/.env`)

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Models with an `openai/` prefix go directly to OpenAI |
| `OPENROUTER_API_KEY` | Every other model goes through OpenRouter |
| `TAVILY_API_KEY` | Web search for Research nodes |
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | Signs login tokens. Use a long random value |
| `PORT` | Backend port (default `3001`) |

### Frontend environment variables

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend URL (default `http://localhost:3001`) |

## Run

```sh
pnpm dev    # frontend on http://localhost:5173, backend on http://localhost:3001
```

## Check

```sh
pnpm --filter backend typecheck
pnpm --filter backend test          # no API keys or network needed
pnpm --filter frontend lint
pnpm --filter frontend build
```

CI (`.github/workflows/ci.yml`) runs the same four commands on pushes and PRs to `master`.

These cost money (they call real models) and are run by hand:

```sh
pnpm --filter backend eval:planner     # planner output quality over 15 goals
pnpm --filter backend bench:parallel   # parallel vs sequential execution timing
```

## Deployment

- Backend: Render — https://agentmesh-va9b.onrender.com
- Frontend: Vercel — https://agent-mesh-frontend-six.vercel.app
- Source: https://github.com/prabal-goyal/AgentMesh
