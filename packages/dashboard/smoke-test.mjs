#!/usr/bin/env node
// E2E smoke test for the Agent Command Center (US-015).
// Exercises: context endpoint, suggest endpoint, skill listing, safe invocation,
// destructive-gate blocking, destructive-gate confirmation, runs log propagation.
//
// Run: `node packages/dashboard/smoke-test.mjs` (gateway must be up on 3210).
// Exits 0 on all-pass, non-zero if any check fails.

const BASE = process.env.GATEWAY_URL || 'http://127.0.0.1:3210';
const tests = [];

function test(name, fn) { tests.push({ name, fn }); }

async function get(path) {
  const r = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`${path} → HTTP ${r.status}`);
  return r.json();
}

async function post(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const data = await r.json();
  return { ok: r.ok, status: r.status, data };
}

function assert(cond, msg) { if (!cond) throw new Error(`ASSERT FAILED: ${msg}`); }

test('health endpoint returns ok', async () => {
  const d = await get('/api/health');
  assert(d.status === 'ok', 'health.status');
  assert(Array.isArray(d.exchanges) && d.exchanges.length > 0, 'exchanges array');
});

test('/api/agent/context returns full harness snapshot', async () => {
  const d = await get('/api/agent/context');
  assert(typeof d.modeLock === 'string', 'modeLock present');
  assert(d.risk && typeof d.risk.equity === 'number', 'risk.equity');
  assert(Array.isArray(d.scraperHealth), 'scraperHealth array');
  assert(d.scraperHealth.length > 0, 'scraperHealth non-empty');
  assert(Array.isArray(d.skills), 'skills array');
  assert(d.skills.length >= 10, `skills count ≥ 10 (got ${d.skills.length})`);
});

test('/api/agent/suggest returns prioritized suggestions', async () => {
  const d = await get('/api/agent/suggest');
  assert(Array.isArray(d.suggestions), 'suggestions array');
  for (const s of d.suggestions) {
    assert(['high','normal','low'].includes(s.priority), `priority valid: ${s.priority}`);
    assert(typeof s.skillId === 'string', 'skillId');
    assert(typeof s.reason === 'string' && s.reason.length > 0, 'reason');
  }
});

test('/api/agent/skills lists all skill definitions', async () => {
  const d = await get('/api/agent/skills');
  assert(Array.isArray(d.skills), 'skills array');
  const cats = new Set(d.skills.map((s) => s.category));
  for (const c of ['trade','inspect','analyze','setup','safety']) {
    assert(cats.has(c), `category present: ${c}`);
  }
  const destructive = d.skills.filter((s) => s.destructive);
  assert(destructive.length >= 1, 'at least one destructive skill');
  for (const s of destructive) {
    assert(s.requiresConfirmation === true, `${s.id} requiresConfirmation`);
    assert(typeof s.confirmWord === 'string', `${s.id} confirmWord`);
  }
});

test('safe skill (risk) invokes and returns ok', async () => {
  const r = await post('/api/agent/skills/risk/invoke', { args: {}, source: 'user' });
  assert(r.ok, `HTTP ${r.status}`);
  assert(r.data.status === 'ok', `status=ok got ${r.data.status}`);
  assert(typeof r.data.output === 'string' && r.data.output.includes('Risk State'), 'risk output');
});

test('destructive skill (panic) blocks without confirmed=true', async () => {
  const r = await post('/api/agent/skills/panic/invoke', { args: {}, source: 'user' });
  assert(r.data.status === 'blocked', `expected blocked, got ${r.data.status}`);
  assert(r.data.reason === 'confirmation_required', 'reason=confirmation_required');
  assert(r.data.confirmWord === 'PANIC', `confirmWord=PANIC got ${r.data.confirmWord}`);
});

test('destructive skill (panic) executes with confirmed=true', async () => {
  const r = await post('/api/agent/skills/panic/invoke', { args: {}, source: 'user', confirmed: true });
  assert(r.ok && r.data.status === 'ok', `expected ok got ${r.data.status}`);
  assert(typeof r.data.output === 'string' && r.data.output.toUpperCase().includes('PANIC'), 'panic output');
});

test('runs log captures recent invocations', async () => {
  const d = await get('/api/agent/runs');
  assert(Array.isArray(d.runs), 'runs array');
  assert(d.runs.length >= 3, `≥3 runs logged (got ${d.runs.length})`);
  const skillIds = d.runs.map((r) => r.skillId);
  assert(skillIds.includes('risk'), 'risk in runs');
  assert(skillIds.includes('panic'), 'panic in runs');
});

test('dashboard HTML is served', async () => {
  const r = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(5000) });
  assert(r.ok, `HTTP ${r.status}`);
  const html = await r.text();
  assert(html.includes('OpenTradex'), 'contains title');
  assert(/assets\/index-[A-Za-z0-9_-]+\.js/.test(html), 'references hashed JS bundle');
  assert(/assets\/index-[A-Za-z0-9_-]+\.css/.test(html), 'references hashed CSS bundle');
});

test('dashboard bundle includes all agent command center components', async () => {
  const html = await (await fetch(`${BASE}/`, { signal: AbortSignal.timeout(5000) })).text();
  const jsPath = html.match(/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0];
  assert(jsPath, 'JS bundle path found');
  const js = await (await fetch(`${BASE}/${jsPath}`, { signal: AbortSignal.timeout(10000) })).text();
  const needles = [
    'command-palette','confirm-modal','agent-console-pill','skills-page',
    'flow-visualizer','flow-node-','suggestions','audit-panel',
    'harness-status','palette-trigger','skills-nav','scraper-badge','active-runs-badge',
    'chain-builder','chain-trigger','chain-run','chain-dryrun','shortcuts-help','help-trigger',
    'autonomous-toggle',
  ];
  for (const n of needles) {
    assert(js.includes(n), `bundle includes testid ${n}`);
  }
});

test('chain dry-run returns dry-run status per step', async () => {
  const r = await post('/api/agent/chains/run', {
    dryRun: true,
    steps: [
      { skillId: 'risk', args: {} },
      { skillId: 'positions', args: {} },
    ],
  });
  assert(r.ok, `HTTP ${r.status}`);
  assert(typeof r.data.chainId === 'string' && r.data.chainId.startsWith('chain-'), 'chainId prefixed');
  assert(Array.isArray(r.data.steps) && r.data.steps.length === 2, 'two steps returned');
  for (const s of r.data.steps) assert(s.status === 'dry-run', `step ${s.skillId} dry-run got ${s.status}`);
  assert(r.data.dryRun === true, 'dryRun echoed');
});

test('chain executes safe steps sequentially', async () => {
  const r = await post('/api/agent/chains/run', {
    steps: [
      { skillId: 'risk', args: {} },
      { skillId: 'positions', args: {} },
    ],
  });
  assert(r.ok, `HTTP ${r.status}`);
  assert(r.data.steps.length === 2, 'two steps ran');
  for (const s of r.data.steps) {
    assert(s.status === 'ok', `step ${s.skillId} ok got ${s.status}`);
    assert(typeof s.runId === 'string', `step ${s.skillId} runId assigned`);
    assert(typeof s.output === 'string' && s.output.length > 0, `step ${s.skillId} output`);
  }
});

test('chain blocks on destructive step without confirmed=true', async () => {
  const r = await post('/api/agent/chains/run', {
    steps: [
      { skillId: 'risk', args: {} },
      { skillId: 'panic', args: {} },
    ],
  });
  assert(r.ok, `HTTP ${r.status}`);
  assert(r.data.steps.length === 2, 'runs until the blocked step');
  assert(r.data.steps[0].status === 'ok', 'safe step completes first');
  assert(r.data.steps[1].status === 'blocked', `panic blocked got ${r.data.steps[1].status}`);
});

test('chain runs in audit log and tagged with chainId', async () => {
  const d = await get('/api/agent/runs');
  const chainRuns = d.runs.filter((r) => r.source === 'chain');
  assert(chainRuns.length >= 2, `≥2 chain runs in audit (got ${chainRuns.length})`);
  const chainIds = new Set(chainRuns.map((r) => r.chainId));
  assert(chainIds.size >= 1, 'at least one chainId bucket');
});

// Run ----
let pass = 0, fail = 0;
for (const t of tests) {
  try {
    await t.fn();
    console.log(`✓ ${t.name}`);
    pass++;
  } catch (e) {
    console.log(`✗ ${t.name} — ${e.message}`);
    fail++;
  }
}
console.log(`\n${pass} passed, ${fail} failed (${tests.length} total)`);
process.exit(fail === 0 ? 0 : 1);
