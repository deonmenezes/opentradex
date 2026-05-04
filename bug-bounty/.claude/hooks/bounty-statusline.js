#!/usr/bin/env node
// Bounty status line — phase, wave coverage, findings, findings/hour,
// loop budget, model, context bar, rate-limit warning.

const fs = require('fs');
const path = require('path');
const os = require('os');

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const model = data.model?.display_name || 'Claude';
    const dir = path.basename(data.workspace?.current_dir || process.cwd());
    const remaining = data.context_window?.remaining_percentage;

    // Context bar
    const AUTO_COMPACT_BUFFER_PCT = 16.5;
    let ctx = '';
    if (remaining != null) {
      const usableRemaining = Math.max(0, ((remaining - AUTO_COMPACT_BUFFER_PCT) / (100 - AUTO_COMPACT_BUFFER_PCT)) * 100);
      const used = Math.max(0, Math.min(100, Math.round(100 - usableRemaining)));
      const filled = Math.floor(used / 10);
      const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
      if (used < 50) ctx = ` \x1b[32m${bar} ${used}%\x1b[0m`;
      else if (used < 65) ctx = ` \x1b[33m${bar} ${used}%\x1b[0m`;
      else if (used < 80) ctx = ` \x1b[38;5;208m${bar} ${used}%\x1b[0m`;
      else ctx = ` \x1b[5;31m${bar} ${used}%\x1b[0m`;
    }

    // Bounty session status — most recent session by mtime
    let bounty = '';
    const sessDir = path.join(os.homedir(), 'bounty-agent-sessions');
    try {
      const dirs = fs.readdirSync(sessDir)
        .map(d => {
          const sf = path.join(sessDir, d, 'state.json');
          try { return { dir: d, mtime: fs.statSync(sf).mtimeMs, state: JSON.parse(fs.readFileSync(sf, 'utf8')), sessPath: path.join(sessDir, d) }; }
          catch { return null; }
        })
        .filter(Boolean)
        .sort((a, b) => b.mtime - a.mtime);

      if (dirs.length > 0) {
        const { state: s, sessPath } = dirs[0];
        const phase = s.phase || '?';
        const wave = s.hunt_wave || 0;
        const findings = s.total_findings || 0;
        const target = s.target || dirs[0].dir;
        const startedIso = s.started_at_iso || s.created_at_iso;

        // Coverage % from attack_surface.json + state.explored
        let coverage = null;
        try {
          const surfaces = JSON.parse(fs.readFileSync(path.join(sessPath, 'attack_surface.json'), 'utf8'));
          const total = (surfaces.surfaces || []).length;
          const explored = (s.explored || []).length;
          if (total > 0) coverage = Math.round((explored / total) * 100);
        } catch {}

        // Findings per hour
        let rate = null;
        if (startedIso && findings > 0) {
          const elapsedHr = (Date.now() - new Date(startedIso).getTime()) / 3600000;
          if (elapsedHr > 0.05) rate = (findings / elapsedHr).toFixed(1);
        }

        // Loop budget (from loop.json)
        let loop = '';
        try {
          const lj = JSON.parse(fs.readFileSync(path.join(sessPath, 'loop.json'), 'utf8'));
          if (lj.started_at_iso && lj.budget_min && !lj.stopped_reason) {
            const elapsedMin = Math.round((Date.now() - new Date(lj.started_at_iso).getTime()) / 60000);
            const pct = Math.min(100, Math.round((elapsedMin / lj.budget_min) * 100));
            const color = pct < 60 ? '\x1b[32m' : pct < 85 ? '\x1b[33m' : '\x1b[31m';
            loop = ` ${color}🔁 ${lj.iters_done}/${lj.max_iters || '?'} ${pct}%\x1b[0m`;
          } else if (lj.stopped_reason) {
            loop = ` \x1b[2m🔁 done(${lj.stopped_reason})\x1b[0m`;
          }
        } catch {}

        // Triage scoring (if present)
        let triage = '';
        try {
          const tj = JSON.parse(fs.readFileSync(path.join(sessPath, 'triage.json'), 'utf8'));
          const p = (tj.promote || []).length;
          const d = (tj.defer || []).length;
          const k = (tj.kill || []).length;
          if (p + d + k > 0) triage = ` \x1b[2mΔ${p}/${d}/${k}\x1b[0m`;
        } catch {}

        const waveStr = phase === 'HUNT' || phase === 'EXPLORE' ? ` W${wave}` : '';
        const covStr = coverage != null ? ` \x1b[36m${coverage}%cov\x1b[0m` : '';
        const findingsStr = findings > 0 ? ` \x1b[32m${findings}f\x1b[0m` : '';
        const rateStr = rate ? ` \x1b[2m${rate}/hr\x1b[0m` : '';
        bounty = ` │ \x1b[1m${phase}${waveStr}\x1b[0m${covStr}${findingsStr}${rateStr}${triage}${loop} │ ${target}`;
      }
    } catch {}

    // Rate limit warning
    let rate = '';
    const fiveHr = data.rate_limits?.five_hour?.used_percentage;
    const sevenDay = data.rate_limits?.seven_day?.used_percentage;
    const worst = Math.max(fiveHr || 0, sevenDay || 0);
    if (worst >= 80) rate = ` \x1b[5;31m⚠ Rate ${Math.round(worst)}%\x1b[0m`;
    else if (worst >= 60) rate = ` \x1b[33m⚠ Rate ${Math.round(worst)}%\x1b[0m`;

    process.stdout.write(`\x1b[2m${model}\x1b[0m │ \x1b[2m${dir}\x1b[0m${bounty}${ctx}${rate}`);
  } catch {}
});
