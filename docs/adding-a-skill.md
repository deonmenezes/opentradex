# Adding a New Skill to the Agent Command Center

Skills are the discrete actions the agent can take and the dashboard can render. Every skill is declared once in `src/agent/skills-registry.ts` and automatically wired into:

- The **Command Palette** (⌘K) — fuzzy-searchable skill launcher
- The **Flow Visualizer** (right sidebar) — DAG of skills by category, clickable
- The **Chain Builder** (press `c`) — multi-step skill pipelines
- The **Proactive Suggestions** engine — recommends skills from dashboard state
- The **Skills page** (`#skills`) — full skill catalog with argument forms
- The **LLM context block** — the AI sees which skills exist and their args

Adding a skill takes three steps.

---

## 1. Register the skill definition

Append to the `SKILLS` array in `src/agent/skills-registry.ts`:

```ts
{
  id: 'my-skill',                    // kebab-case unique id
  name: 'My Skill',                  // Title Case label
  category: 'inspect',               // 'trade' | 'inspect' | 'analyze' | 'setup' | 'safety'
  description: 'One-line description of what this skill does.',
  args: [
    {
      name: 'symbol',
      type: 'string',                // 'string' | 'number' | 'enum'
      required: true,
      description: 'The symbol to operate on',
    },
    {
      name: 'mode',
      type: 'enum',
      required: false,
      enumValues: ['fast', 'slow'],
      defaultValue: 'fast',
      description: 'Execution mode',
    },
  ],
  destructive: false,                // true ⇒ gated by confirmation
  requiresConfirmation: false,       // true ⇒ dashboard shows type-to-confirm modal
  // confirmWord: 'DESTROY',         // required if requiresConfirmation=true
  exampleInvocations: [
    'my-skill AAPL fast',
  ],
  commandTemplate: 'my-skill {symbol} {mode}',
},
```

### Category semantics

| Category  | Purpose                                      | Typical destructive? |
|-----------|----------------------------------------------|----------------------|
| `trade`   | Open / modify positions                      | Sometimes            |
| `inspect` | Read-only snapshots (risk, positions, scans) | Never                |
| `analyze` | AI-authored thesis / candidate ranking       | Never                |
| `setup`   | Config, onboarding, loop toggles             | Never                |
| `safety`  | Kill switches, cooldowns                     | Always               |

### The `commandTemplate` contract

`renderCommand(skill, args)` replaces `{argName}` tokens with user-provided values before passing the result to `routeIntent()`. So your skill's command template must match a regex in `src/ai/intents.ts`, OR you must add a special-case branch in the gateway invoke handler (see `src/gateway/index.ts` near the `panic` / `candidates` handlers for precedent).

---

## 2. Wire the execution path

Most skills route through the intent matcher. Add a handler to `INTENTS` in `src/ai/intents.ts` that matches `commandTemplate` once tokens are filled:

```ts
{
  name: 'my-skill',
  help: '/my-skill <symbol> <mode> — do the thing',
  pattern: /^\s*(?:\/|)my-skill\s+([A-Z]+)\s+(fast|slow)\s*$/i,
  handler: async (match, _c, _ctx) => {
    const [, symbol, mode] = match;
    // Do the work. Return { action, reply, data? }.
    return {
      action: 'my-skill.done',
      reply: `Ran my-skill on ${symbol} in ${mode} mode.`,
      data: { symbol, mode },
    };
  },
},
```

### For destructive skills

Destructive skills are gated twice:

1. **Dashboard gate** — the UI shows a type-to-confirm modal that won't POST unless the user types the exact `confirmWord`.
2. **Gateway gate** — `POST /api/agent/skills/:id/invoke` returns `{ status: 'blocked', confirmWord }` unless the body includes `confirmed: true`. The second call with `confirmed: true` then executes.

For the **Chain Builder**, each destructive step must be individually confirmed before `submit()` — the UI shows a per-step "Confirm ✓" button that sets `step.confirmed = true` in the POSTed body.

---

## 3. Verify end-to-end

From the repo root:

```bash
npm run build                         # Type-check + compile the gateway
npm run build:dashboard               # Rebuild the dashboard bundle
npm run gateway                       # Start gateway on :3210
```

Then hit it:

```bash
# List — your skill should appear
curl -s http://localhost:3210/api/agent/skills | grep my-skill

# Invoke (safe skill)
curl -s -X POST http://localhost:3210/api/agent/skills/my-skill/invoke \
  -H 'Content-Type: application/json' \
  -d '{"args":{"symbol":"AAPL","mode":"fast"},"source":"user"}'

# Destructive skill — first call should block
curl -s -X POST http://localhost:3210/api/agent/skills/my-skill/invoke \
  -H 'Content-Type: application/json' \
  -d '{"args":{"symbol":"AAPL"},"source":"user"}'
# → { "status": "blocked", "confirmWord": "…" }

# Second call with confirmed=true should execute
curl -s -X POST http://localhost:3210/api/agent/skills/my-skill/invoke \
  -H 'Content-Type: application/json' \
  -d '{"args":{"symbol":"AAPL"},"source":"user","confirmed":true}'
```

Open `http://localhost:3210/` — your skill now appears in:

- **⌘K Command Palette** — fuzzy match `My Skill`
- **Right sidebar Flow Visualizer** — new node in the `inspect` column
- **Skills page** (`#skills`) — full card with argument form
- **Chain Builder** (`c` key) — picker list under the correct category

Run the smoke test to lock it in:

```bash
node packages/dashboard/smoke-test.mjs
```

Add a test case for your skill in `smoke-test.mjs` if it has meaningful behavior beyond the generic invoke/block/confirm path.

---

## Design rules

- **One verb per skill.** `Buy Kalshi` and `Buy Crypto` are separate skills because the args differ. Don't parameterize rails across a single skill — it kills suggestions and confuses the UI.
- **Safe by default.** Only mark `destructive: true` if the skill modifies state AND that change is hard to reverse (closes a position, flips autoloop, wipes a cooldown). Opening a paper position is not destructive.
- **Confirmation words are nouns.** `PANIC`, `CLOSE`, `REDUCE`. Never `YES`. The word telegraphs the action so muscle-memory can't misfire.
- **Keep descriptions < 140 chars.** They render on a single line in the palette and sidebar.
- **Give ≥ 1 `exampleInvocations`.** The suggestion engine and LLM context both use these as few-shot examples.

---

## Surfaces a skill automatically appears on

| Surface                   | Source                                  |
|---------------------------|------------------------------------------|
| Command Palette (⌘K)      | `/api/agent/skills` via `useHarness`     |
| Flow Visualizer           | `FlowVisualizer.tsx` groups by category  |
| Chain Builder (`c`)       | `ChainBuilder.tsx` skill picker          |
| Skills page (`#skills`)   | `SkillsPage.tsx` rendered per-category   |
| Proactive Suggestions     | `suggestionEngine` (rule-based, 20s poll)|
| LLM prompt context        | `buildContext()` in `src/ai/index.ts`    |
| Runs audit log            | Every invocation writes to `runs-log.ts` |
| WebSocket broadcasts      | `run:*`, `chain:*` events                |

You get all of the above for free by adding a single entry to `SKILLS`.
