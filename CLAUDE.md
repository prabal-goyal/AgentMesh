# AI Workflow Builder — Project Rules

This is a **learning project**. The goal is to understand concepts and architecture, not just ship working code. These rules apply to every session.

## Project Boundary Rules

**All work stays inside `D:\AIWorkflow\`.** These rules override everything else and apply to every session without exception.

1. **No files outside the project** — Never create, edit, delete, or copy files outside `D:\AIWorkflow\`. This includes `C:\Users\praba\.claude\` — do not touch it.
2. **Skills and commands live here** — All slash commands go in `.claude/commands/`. Never copy or install them globally.
3. **Settings stay local** — Use `.claude/settings.local.json` for MCP servers and permissions. Never modify the user-level settings file.
4. **No global package installs** — Use `pnpm add` scoped to the project workspace only. Never `npm install -g` or `pnpm add -g`.
5. **Git operations target this repo only** — All git commands must reference `D:/AIWorkflow`. Never run git on any other directory.
6. **If a task requires touching something outside this folder, stop and ask first.**

## Collaboration Rules

1. **Explain before code** — Before writing any file, explain what it does, why it exists in the architecture, and what concept it demonstrates. Wait for confirmation before proceeding.

2. **Concepts called out inline** — When hitting something non-obvious (topological sort, SSE, CORS, env vars, DAG execution, Zustand middleware, React Flow internals), pause and explain the concept in plain terms as a conversation checkpoint — not buried in a comment.

3. **No magic abstractions early** — Build things manually first before using shortcuts or helper libraries. Raw Express, raw fetch, raw SSE first so the user understands what's happening underneath.

4. **Strategic comments in code** — This project is an exception to the no-comments default. Add short "why" comments at non-obvious points, especially in backend files and AI/OpenRouter calls.

5. **One concept per phase** — Each phase has a primary learning goal. Don't mix Phase 3 concepts into Phase 2 even if it seems efficient.

6. **User verifies before proceeding** — At the end of each phase, the user runs it, sees it working in browser/terminal, confirms understanding, then we move to the next phase.

7. **Stop and ask anytime** — If something feels like a black box, unpack it fully before continuing. No skipping.

## Answer-Quality Rules

Adapted from `multica-ai/andrej-karpathy-skills` — a third-party distillation of an Andrej Karpathy X post on common LLM coding mistakes, not his verbatim words. Kept only the parts that add something beyond the Collaboration Rules above.

1. **Present interpretations, don't pick silently** — When a request has multiple reasonable readings, list them and ask which one, instead of quietly choosing.
2. **The overcomplication gut-check** — Before calling code done, ask "would a senior engineer call this overcomplicated?" No abstractions, flexibility, or config for a single call site that wasn't asked for.
3. **Surgical diffs** — Don't reformat or "improve" adjacent code/comments while making a change. Match existing style even when you'd write it differently. Mention unrelated dead code you notice — don't delete it. Only remove imports/variables that your own change made unused.
4. **State a step → verify plan for multi-step work** — Before executing, write out steps with what verifies each one (build/lint passes, user confirms in browser, endpoint returns expected response), so the goal is checkable rather than vague.

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
- ✅ **Phase 6** — Inspection + Editing — retry single node, copy output, auto-scroll, reset button
- ✅ **Phase 7** — Tavily web search — tool use loop, streaming tool call detection, Research nodes only
- ✅ **Phase 8** — Conditional / Router Node — yes/no branching, dynamic DAG pruning, skipped node status on canvas, AI Planner aware of Router nodes
- ✅ **Phase 9** — Parallel Execution — wave-based topo sort, Promise.allSettled per wave, concurrent SSE events, multiple nodes running simultaneously
- ✅ **Phase 10** — Run History + Cost Tracker — run_usage SSE event, token counts from API response, Zustand history stack, cost per model per run, history sidebar
- 🔲 **Phase 11** — Authentication + Save/Load + Templates — Neon Postgres, raw `pg` driver, `users` table, signup/login, bcrypt password hashing, JWT auth (Bearer token in `localStorage`); `workflows` table scoped per user, Save button, real "My Workflows" list; 3 built-in templates (blog writer, research report, code reviewer); also fix results screen to show all node outputs not just the final one. *(Originally two separate phases — Save/Load and Authentication — merged here since per-user saved workflows require real accounts; former Phase 15 retired.)* ← **NEXT**
- 🔲 **Phase 12** — Variable Injection — `{{topic}}`, `{{tone}}` placeholders in prompts, pre-run input form, no editing nodes every time
- 🔲 **Phase 13** — File Upload Node — drop in PDF/text file, content injected as output into downstream nodes
- 🔲 **Phase 14** — Auto-Retry — failed node retries once automatically before marking as error; no silent total failures
- 🔲 **Phase 15** — Share via Link — encode workflow in a shareable URL; recipient can run it but not edit it
- 🔲 **Phase 16** — Proper Login Flow + SSO — builds on Phase 11's basic email/password auth: Google (and optionally GitHub) sign-in via OAuth authorization-code + PKCE flow, `oauth_accounts` table linking a provider identity to a user (`users.password_hash` becomes nullable — an OAuth-only user has no password), backend redirect/callback routes, token exchange via a maintained library rather than fully raw. Also revisit signup UX (email verification, password reset) if still missing by then.

**Deferred (revisit after user testing):**
- Human-in-the-Loop — pause mid-run for user review (power feature; users need comfortable baseline first)
- Fallback Node — route to a backup node after retry failure (advanced; build after auto-retry lands)
- Email Output Node — send final output to an inbox (needs email service; no user has asked for it yet)
- Scheduled Runs — run a workflow on a timer (most advanced; needs auth + proven user value first)

## Improvements Backlog (code review — Sep 2026)

Findings from a full read of `backend/src/` and `frontend/src/`, ranked by value.
Each item notes the CV/portfolio claim it unlocks. Independent of the phase plan
above — these are fixes and instrumentation, not new features.

### P0 — Security (live deployment, exploitable today)

1. ✅ **DONE — `/api/execute`, `/api/execute/stream` and `/api/plan` were unauthenticated.**
   They were an open LLM proxy: anyone with the Render URL could POST an arbitrary
   `model` + `systemPrompt` and spend our OpenRouter/OpenAI credits without limit.
   **Shipped:** `requireAuth` + per-user quota on all three (`middleware/runQuota.ts`,
   20 runs/hr, 40 plans/hr, keyed on `userId` not IP); zod schemas at the trust
   boundary (`lib/validation.ts`) with routes passing `parsed.data`, never `req.body`;
   model allowlist derived from `MODEL_PRICING` via the exported `ALLOWED_MODELS`;
   caps on node count (20), edge count (60), prompt (8k chars) and goal length.
   On `/stream`, validation runs before `res.writeHead` so rejections are a real
   JSON 400 rather than an error wrapped in a 200 stream.
   Three bugs fixed in passing: `anthropic/claude-sonnet-4-6` was missing from
   `MODEL_PRICING` (Sonnet runs reported $0.00 — prices added but **unverified
   against OpenRouter**); dangling edges that crashed `topoWaves`' non-null
   assertion are now rejected; execute vs plan goal limits split so the
   single-node retry path (which packs parent outputs into `goal`) still fits.
   *Unlocks:* "Hardened a public LLM execution endpoint against prompt/model
   injection and cost abuse — schema validation, model allowlisting, per-user
   quotas, JWT gating on every inference path."
   *Known gaps:* a 401 surfaces as an error string instead of bouncing to
   `AuthScreen`; `requireAuth` does not check the user still exists in Postgres;
   quota is in-memory so it resets on restart and counts per-instance (item 2
   makes it durable).

### P1 — Instrumentation (this is what produces real numbers)

2. ✅ **DONE — Persist runs to Postgres.** `run_usage` events used to land only in
   the Zustand history stack and die on refresh.
   **Shipped:** `runs` and `node_runs` in `db/schema.sql` — `NUMERIC(14,8)` for
   money (never FLOAT), `CHECK` constraints on status, `ON DELETE CASCADE` from
   users → runs → node_runs, and indexes on `runs(user_id, created_at DESC)`,
   `node_runs(run_id)`, `node_runs(model)`. Writes live in `db/runs.ts`
   (`startRun` / `recordNodeRun` / `finalizeRun`), incremental: the run row is
   inserted as `'running'` before wave 1, each node row as it finishes, then the
   run is finalized — so a crashed or abandoned run stays visibly `'running'`
   instead of being silently absent.
   Deviation from the spec above: `total_tokens` is stored as separate
   `total_input_tokens` / `total_output_tokens`, because input and output are
   priced 4-5x apart and a single column makes per-run cost unexplainable.
   Every function in `db/runs.ts` swallows its own errors and logs loudly —
   telemetry must never fail a user's workflow.
   Persistence hangs off the SSE event stream in `routes/execute.ts`, so
   `lib/executor.ts` has **no database import** — deliberate, since that is the
   module item 7 most needs to unit-test.

3. ✅ **DONE — Latency timing.** `runNode()` now records time-to-first-token and
   wall-clock per node; both ride on the `run_usage` SSE event and land in
   `node_runs`. TTFT is captured at the first token the user actually *sees*, so
   for a research node it marks the "🔍 Searching" line rather than the
   post-search prose — it measures how long the pane sat empty. `ttft_ms` is
   nullable because a node that errored before streaming never had a first
   token, and 0 would drag every average down.
   The `error` event gained `nodeId` + `durationMs`, so failed nodes appear in
   latency data instead of vanishing. That also fixed a frontend bug where any
   single node's failure turned the **whole canvas** red.
   Verified end-to-end against Neon: success, router-only, and provider-401
   paths all persist correctly; `{runs, failed, avg_cost, p95_ms}` and per-model
   avg TTFT/duration/spend each come back in one SQL query.
   *Unlocks:* "Instrumented per-node cost and latency (TTFT, wall-clock, tokens)
   across 4 model providers."
   *Still open:* the "parallel wave execution cut p95 from Xs to Ys" claim needs
   the sequential baseline measured — the sync `executeWorkflow` is **not**
   instrumented, and that benchmark blocks item 10.
   *Open decision:* router/conditional nodes make no provider call, so they emit
   no `run_usage` and leave holes in per-node history. Record them at cost 0 for
   DAG completeness, or leave the table purely about inference?

### P1 — Correctness bugs

4. ✅ **DONE — `topoWaves()` had no cycle detection.** With a cycle the `while`
   loop simply ran out of work and the cyclic nodes were silently dropped, yet
   the run reported success with their outputs missing.
   **Shipped:** Kahn's terminal check — if fewer nodes were scheduled than
   exist, the leftovers are the cycle (they all still have in-degree > 0 because
   they wait on each other). `topoWaves` now throws a typed `CyclicGraphError`
   carrying `nodeIds`, so callers can tell a malformed workflow apart from a
   provider failure.
   **Rejection happens at the validation layer, not at runtime:** the zod
   `superRefine` in `lib/validation.ts` calls `topoWaves` itself — one algorithm,
   no second implementation of Kahn's to drift — so a cyclic graph gets a clean
   **400 before** the SSE stream opens, before a `runs` row is written and
   before any provider call. Dangling-edge errors take precedence, since that
   is the more actionable message. The error names only the trapped nodes
   ("nodes 2, 3 depend on each other"), and a self-loop is worded in the
   singular. `topoWaves` still throws on direct call as defense in depth.
   Verified over HTTP on both routes: two-node cycle, three-node cycle,
   self-loop, and partial cycle all 400; acyclic diamond still streams.
   The two characterization tests that pinned the old behavior were replaced by
   11 rejection tests (82 total).
   *Unlocks:* upgrades "topological sort" to "validated DAG execution with cycle
   rejection."

5. ✅ **DONE — but the premise below was wrong; read this first.**

   **Retries already existed.** Both clients are OpenAI SDK instances, and the
   SDK defaults to `maxRetries: 2`, retrying 408/409/429/5xx with exponential
   backoff (0.5s→8s, 25% jitter) while honouring `Retry-After` and
   `x-should-retry` (`client.js:553`). Hand-rolling a retry loop on top would
   have **multiplied** attempts — 3 × 3 = 9 provider calls per node — not
   improved reliability. So we configured the SDK rather than wrapping it:
   `REQUEST_TIMEOUT_MS = 60_000` and an explicit `maxRetries: 2` in
   `lib/openrouter.ts`, replacing an accidental 10-minute default.

   **Measured finding that shaped the design:** the SDK clears its request timer
   when `fetch()` resolves, and `fetch()` resolves on *headers*. Both providers
   hold headers until generation starts — measured gap of **2ms (OpenRouter)**
   and **23ms (direct OpenAI)** between headers and first token. So the SDK
   timeout is in practice a **time-to-first-token** budget, not a connection
   timeout, and must stay generous. A tight value would kill slow models.

   **What was genuinely missing:** nothing bounded the gaps *between* chunks.
   A provider that sent one token then went silent held the SSE connection open
   forever. Fixed by `lib/stream.ts` — `withStallTimeout`, an async generator
   that arms a timer per chunk and aborts an `AbortController` when it fires,
   throwing a typed `ProviderStallError`. Two budgets:
   `FIRST_CHUNK_TIMEOUT_MS = 90_000` (a backstop; the SDK timeout usually fires
   first given the measurement above) and `BETWEEN_CHUNKS_TIMEOUT_MS = 20_000`.
   The timer is re-armed **after** the consumer takes the chunk, so socket
   writes and Postgres inserts are never mistaken for a stalled provider.
   Aborting matters as much as throwing: an abandoned socket leaves the provider
   generating a response nobody reads, and billing for it.

   **Known limitation:** the guard cannot cover the pre-headers window, because
   it only wraps the stream `create()` returns. If a provider withholds headers
   entirely, the SDK's request timeout is the only bound. Documented in
   `stream.integration.test.ts`.

   *Tests:* 12 unit cases plus 5 integration cases that run the guard against
   the **real OpenAI SDK** reading a local fake provider which hangs mid-stream
   (localhost only, no key, CI-safe). Mutation-tested: moving the re-arm before
   the yield, and dropping the error conversion, each fail the suite.
   *Unlocks:* "Bounded provider calls with per-request timeouts and stall
   detection on streaming responses, converting unbounded hangs into typed,
   attributable per-node failures."
   *Not done:* the failure-rate before/after number still needs the `runs` table
   to accumulate real traffic.

   ~~Original entry:~~ **No timeouts or retries on provider calls.** No `AbortController` anywhere —
   a hung provider stream holds the SSE connection open indefinitely. Add a
   per-call timeout plus one retry with backoff on 429/5xx. (This is Phase 14,
   promoted: it is a reliability bug, not a feature.)
   *Unlocks:* "Bounded retries with exponential backoff and per-call timeouts,
   cutting run failure rate from X% to Y%."

6. ✅ **DONE — decided: the skip rule was right, the prompt building was not.**

   **`shouldSkip` is unchanged, and "all parents" is deliberate.** Trace the
   canonical Router pattern — `Router →(yes) A`, `Router →(no) B`, `A → C`,
   `B → C`. Taking the yes branch prunes B, so the join C has one live parent
   and one skipped one. Under "all" C runs on A's output, which is the entire
   point of converging after a branch. Under "any parent skipped" C would also
   be pruned and **every branching workflow would die at its join node**. The
   reasoning is now a comment on the function so it no longer reads as an
   accident.

   **The actual defect was in `buildUserMessage`.** It emitted a labelled
   stanza for every parent including pruned ones, so the model received
   `[Rejected Path]:` followed by nothing — paid-for input tokens carrying no
   information and an invitation to invent the missing content. This affected
   **errored** parents too, not just router-pruned ones, since neither leaves an
   entry in `outputs`.
   **Fixed:** non-contributing parents (empty or whitespace-only output) are
   filtered out before the context is built; if *every* parent contributed
   nothing the message falls back to the goal rather than sending "Here is the
   output from the previous step:" followed by emptiness; and a
   `console.warn` reports it, matching how `db/runs.ts` logs instrumentation
   failures. No new SSE event — the canvas already greys out skipped nodes.

   *Verified on a real 5-node Router workflow:* the pruned branch was skipped,
   the join still ran, its summary referenced only the live branch
   (`Received "GREEN LIGHT" approval.`) with no phantom empty stanza, and the
   server logged
   `⚠️  [Summary] ran without input from 1 of 2 parents (Rejected Path)`.
   *Tests:* `buildUserMessage` exported and given 9 cases; the pinned
   characterization test replaced by 3 stating the rule is intentional,
   including the Router-join case. Mutation-tested: restoring the old
   unfiltered behaviour fails 5 tests. 113 total.

   ~~Original entry:~~ **`shouldSkip()` partial-parent semantics** (`lib/executor.ts:71`). The rule
   requires *all* parents skipped. A node with one pruned parent and one live
   parent runs anyway and reads `outputs[id] ?? ''` for the pruned one — silently
   empty context, no warning. Decide the semantics deliberately and log when a
   parent contributes nothing.

### P2 — Credibility

7. ✅ **DONE — No tests existed in this repo.** Now 70 vitest cases across four
   files, running in ~0.6s with **zero API calls and no credentials**:
   - `lib/executor.test.ts` — `topoWaves` (chain, fan-out, diamond join,
     disconnected subgraphs, empty, cycles), `getParentIds`,
     `evaluateCondition`, `shouldSkip` cascade, `calcCost`
   - `lib/validation.test.ts` — allowlist incl. the conditional empty-model
     exemption, dangling edges, duplicate ids, every abuse cap, unknown-key
     stripping, goal limits
   - `middleware/runQuota.test.ts` — limit, 429 message, window reset,
     per-user isolation, missing userId → 401 (fake timers)
   - `lib/openrouter.test.ts` — prefix stripping, provider routing, client reuse

   **Root-cause fix that unblocked this:** `lib/openrouter.ts` now builds both
   OpenAI clients **lazily** instead of at module load. Eager construction meant
   importing the executor required real API keys, and it also made the
   `⚠️ OPENAI_API_KEY is not set` warning in `index.ts` unreachable — ESM
   evaluates imports before the module body, so the SDK crashed first.

   **Characterization tests:** backlog items 4 and 6 are pinned by tests that
   assert their *current buggy* behavior, named e.g.
   `currently DROPS cyclic nodes instead of rejecting them (backlog #4)`.
   CI stays green and the bug is documented in executable form. **When 4 or 6
   is fixed those tests will fail on purpose** — flip them to rejection tests.

   `.github/workflows/ci.yml` runs backend typecheck + test and frontend lint +
   build on push/PR to master. Suite was mutation-tested (deliberately breaking
   `evaluateCondition`'s default and `topoWaves`' join condition made 3 tests
   fail) to confirm it isn't vacuous.
   *Not covered:* `runNode`'s streaming loop, TTFT capture and the tool-call
   delta accumulator — they need a mocked provider client, deferred by choice.

8. ✅ **DONE — Planner eval harness.** `src/eval/planner-eval.ts`, run with
   `pnpm eval:planner`. 15 goals, six checks each: JSON parses, node types valid,
   models allowlisted, graph is a DAG (via the **real** `topoWaves`, so it
   asserts exactly what execution requires), ≤4 nodes, no empty systemPrompts.
   Imports `PLANNER_SYSTEM_PROMPT` from `routes/plan.ts` so it tests the shipped
   prompt rather than a copy that drifts. Deliberately **not** in CI: it calls a
   real model, so it costs money and yields a pass *rate*, not a pass/fail gate.

   **It immediately found a live bug.** gpt-4o-mini omits the `model` field
   entirely on a large share of goals — 7 of 15 on the first run, **53% pass
   rate**. The frontend maps `model: n.model` with no fallback (despite
   `NODE_MODEL_DEFAULTS` sitting in the same store), so those nodes reached the
   canvas as `model: undefined` and then failed execute-time validation with an
   opaque error. Roughly half of all AI-planned workflows were affected.
   **Fixed** in `routes/plan.ts` with `normalizePlan()`, which fills the model
   from the node type before responding — server-side, so every client benefits.
   Also added a `try/catch` around `JSON.parse` of the completion (it had none;
   malformed output surfaced as an opaque 500, now a 502 with a clear message).
   **53% → 100%.** The harness still reports how many models it had to auto-fill
   (14 on the last run) as a drift signal, since the route repairs them and
   users never see a failure.
   *Unlocks:* "Regression suite over 15 planning prompts asserting schema
   validity and DAG acyclicity; raised structured-output reliability from 53% to
   100%."

9. ✅ **DONE — Multi-hop tool loop.** `runNode()` handled `tool_calls[0]` only
   and ran exactly one search round, so "search, read, search again" was
   impossible. The two hardcoded phases are now a bounded loop
   (`MAX_TOOL_ROUNDS = 3`). Tool-call deltas accumulate into a
   `Map` keyed by the delta's `index`, so a model opening several calls at once
   is handled rather than silently truncated to the first; the calls in a round
   run together under `Promise.all` since they are independent. Tools are
   withheld on the final round, which forces a text answer instead of ending the
   budget mid-decision. `runTool` returns its failures as text rather than
   throwing, so the model can recover on the next round from a malformed
   argument or an unknown tool name.
   *Verified:* a research node issued two distinct searches
   (`latest Node.js LTS version`, then `latest stable Python version`) and
   answered from both — impossible under the old single-round path.
   *Tests:* `runTool`'s non-network branches only (4 cases). The loop mechanics
   still need a mocked provider — the same gap item 7 documented.

10. ✅ **DONE — Deleted `executeWorkflow()` and the whole dead sync path.**
    Removed: `executeWorkflow` from `lib/executor.ts`, `POST /api/execute` from
    `routes/execute.ts` (nothing called it), and the unused `executeWorkflow`
    helper in `frontend/src/api/client.ts` (zero call sites).
    `POST /api/execute/stream` is unaffected.

    **First, the benchmark it was blocking** (`pnpm bench:parallel`,
    `src/eval/parallel-benchmark.ts`): 4 nodes in 2 waves (1 then 3),
    gemini-2.5-flash, 3 iterations per mode.
    **median sequential 4954ms → median parallel 2239ms = 2.21x (55% faster).**
    The benchmark carries its own copy of the sequential runner, so the
    comparison stays reproducible now that the production copy is gone.
    ⚠️ *Caveat to state honestly if this number is used:* the sequential
    baseline makes **non-streaming** calls, because that is what
    `executeWorkflow` actually did. So this measures "old sync path vs current
    wave path", not scheduling in isolation, and it slightly exceeds the ~2.00x
    theoretical ceiling for this graph shape as a result.

### Portfolio framing (built but undocumented)

The following ship today and are missing from the CV — they are stronger material
than what is currently written there:
- **Parallel wave execution** (`Promise.allSettled` per topological wave) — the
  most impressive thing in the executor.
- **Multi-provider routing** — `resolveModel()` sends `openai/*` direct to OpenAI
  and everything else through OpenRouter, with per-role model selection.
- **Anthropic `cache_control: ephemeral` prompt caching** on system prompts.
- **Planner response cache** keyed on the normalised goal string.
- JWT + bcrypt auth, per-IP sliding-window rate limiter, Postgres persistence.

Also stale: the Project Boundary Rules above reference `D:\AIWorkflow\`; the repo
now lives at `E:\AgentMesh`. Phase 11 is marked NEXT but is shipped
(`routes/auth.ts`, `routes/workflows.ts`, `db/schema.sql` all exist).

## Session Resume Instructions

When resuming: greet the user, confirm which phase is next (shown above), briefly recap what was built last, and ask if they're ready to continue or have questions first. Do NOT restart from scratch or re-explain Phase 1.

## Deployment

- **Backend**: Render — https://agentmesh-va9b.onrender.com
- **Frontend**: Vercel — https://agent-mesh-frontend-six.vercel.app
- **GitHub**: https://github.com/prabal-goyal/AgentMesh
