#!/usr/bin/env node
// =============================================================================
//  Infinite Rail logic simulator / regression test
//
//  Runs the ACTUAL shared .mcfunction files emitted by the build (both the
//  Java copy and the dialect-rewritten Bedrock copy) through a tiny
//  interpreter of the shared dual-dialect command subset, drives them with
//  the same per-column pipeline the engines use (sample window -> decide ->
//  place), and asserts the event-model invariants on synthetic terrains:
//
//    - the two edition copies make IDENTICAL decisions column for column
//    - every elevation change is one contiguous 45-degree event
//    - events only start when |target - railY| >= #DEADBAND (checked exactly)
//    - flat gaps between events respect #SAMEGAP / #TURNGAP (exact counting)
//    - on terrain that settles, the rail converges onto terrain + #HOVER
//
//  All knobs come from the emitted config.mcfunction itself (run through the
//  interpreter), never from constants duplicated here -- retuning the config
//  cannot silently weaken or spuriously fail these checks.
//
//  It also checks the SHIPPED smooth-camera construction (imported from
//  src/bedrock/bp/scripts/cam_math.js, the module the Bedrock pack runs) for
//  its core guarantees: never below the rail line, exact on settled flats,
//  parallel mid-climb.
//
//  Run after tools/build.mjs:  node tools/simulate.mjs
// =============================================================================

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { camHeight } from '../src/bedrock/bp/scripts/cam_math.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JAVA_FN = join(ROOT, 'dist', 'java', 'infinite_rail', 'data', 'infinite_rail', 'function');
const BEDROCK_FN = join(ROOT, 'dist', 'bedrock', 'InfiniteRail_BP', 'functions', 'infinite_rail');

let failures = 0;
const fail = (msg) => { failures += 1; console.error(`  FAIL: ${msg}`); };
const ok = (msg) => console.log(`  ok: ${msg}`);

if (!existsSync(JAVA_FN) || !existsSync(BEDROCK_FN)) {
  console.error('dist/ not found -- run `node tools/build.mjs` first');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// A minimal interpreter for the shared dual-dialect command subset (the build
// lint guarantees shared files contain nothing else). Any line it cannot
// parse EXACTLY is an error -- silently skipping a condition or command would
// let a regression hide behind the interpreter's own blind spot.
// ---------------------------------------------------------------------------
const CONDS_RE = /^(?:(?:if|unless) score \S+ ir (?:matches \S+|(?:<=|>=|=|<|>) \S+ ir) )+$/;

class Sim {
  constructor(fnDir, prefix) {
    this.fnDir = fnDir;
    this.prefix = prefix; // '#' for the Java copy, '.' for the Bedrock copy
    this.scores = new Map();
    this.fns = new Map();
  }

  load(name) {
    if (!this.fns.has(name)) {
      const text = readFileSync(join(this.fnDir, `${name}.mcfunction`), 'utf8');
      this.fns.set(name, text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')));
    }
    return this.fns.get(name);
  }

  get(name) { return this.scores.get(this.prefix + name) ?? 0; }
  set(name, v) { this.scores.set(this.prefix + name, v | 0); }

  call(name) { for (const line of this.load(name)) this.exec(line); }

  exec(cmd) {
    let m;
    if ((m = cmd.match(/^scoreboard players (set|add|remove) (\S+) ir (-?\d+)$/))) {
      const [, op, who, val] = m;
      const v = parseInt(val, 10);
      const cur = this.scores.get(who) ?? 0;
      this.scores.set(who, op === 'set' ? v : op === 'add' ? cur + v : cur - v);
      return;
    }
    if ((m = cmd.match(/^scoreboard players reset (\S+)(?: ir)?$/))) {
      this.scores.delete(m[1]);
      return;
    }
    if ((m = cmd.match(/^scoreboard players operation (\S+) ir (=|\+=|-=|\*=|\/=|%=|<|>|><) (\S+) ir$/))) {
      const [, a, op, b] = m;
      const av = this.scores.get(a) ?? 0;
      const bv = this.scores.get(b) ?? 0;
      const floordiv = (x, y) => Math.floor(x / y);
      const r = { '=': bv, '+=': av + bv, '-=': av - bv, '*=': av * bv,
        '/=': floordiv(av, bv), '%=': av - floordiv(av, bv) * bv,
        '<': Math.min(av, bv), '>': Math.max(av, bv), '><': bv }[op];
      this.scores.set(a, r | 0);
      if (op === '><') this.scores.set(b, av | 0);
      return;
    }
    if ((m = cmd.match(/^function infinite_rail[:/]([a-z0-9_]+)$/))) {
      this.call(m[1]);
      return;
    }
    if (cmd.startsWith('execute ')) {
      m = cmd.match(/^execute (.+? )run (.+)$/);
      if (!m) throw new Error(`unparseable execute: ${cmd}`);
      if (this.conds(m[1])) this.exec(m[2]);
      return;
    }
    throw new Error(`unsupported command in shared file: ${cmd}`);
  }

  conds(str) {
    // Strict: the whole condition string must be well-formed if/unless-score
    // clauses; an unrecognized clause is an error, never a silent pass.
    if (!CONDS_RE.test(str)) throw new Error(`unparseable execute conditions: "${str}"`);
    const re = /(if|unless) score (\S+) ir (?:matches (\S+)|(<=|>=|=|<|>) (\S+) ir)/g;
    let m;
    while ((m = re.exec(str))) {
      const [, kind, who, range, cmp, other] = m;
      const v = this.scores.get(who) ?? 0;
      let pass;
      if (range !== undefined) pass = inRange(v, range);
      else {
        const o = this.scores.get(other) ?? 0;
        pass = { '<': v < o, '<=': v <= o, '=': v === o, '>=': v >= o, '>': v > o }[cmp];
      }
      if (kind === 'unless') pass = !pass;
      if (!pass) return false;
    }
    return true;
  }
}

function inRange(v, range) {
  let m;
  if ((m = range.match(/^(-?\d+)$/))) return v === +m[1];
  if ((m = range.match(/^(-?\d+)\.\.$/))) return v >= +m[1];
  if ((m = range.match(/^\.\.(-?\d+)$/))) return v <= +m[1];
  if ((m = range.match(/^(-?\d+)\.\.(-?\d+)$/))) return v >= +m[1] && v <= +m[2];
  throw new Error(`bad range: ${range}`);
}

// ---------------------------------------------------------------------------
// The per-column pipeline, exactly as both engines drive it: sample the next
// 48 blocks, hand target+railY to the shared decide, act on the returned dir.
// Every knob is read from the emitted config.mcfunction via the interpreter.
// ---------------------------------------------------------------------------
const CFG_KEYS = ['HOVER', 'DEADBAND', 'SAMEGAP', 'TURNGAP', 'UPCLAMP', 'DOWNCLAMP',
  'CAMBLEND', 'CAMLIFT', 'CAMSMOOTH', 'CAMAHEAD', 'SLOPECLEAR'];

function advance(sim, S, surface, cfg) {
  const lo = S.avg - cfg.DOWNCLAMP;
  const hi = S.avg + cfg.UPCLAMP;
  let sum = 0;
  for (let off = 4; off <= 48; off += 4) {
    let s = surface(S.headX + off);
    if (s === undefined || s <= -63) s = S.avg;
    sum += Math.min(Math.max(s, lo), hi);
  }
  S.avg = Math.floor(sum / 12);
  const target = S.avg + cfg.HOVER;

  sim.set('target', target);
  sim.set('railY', S.railY);
  sim.call('decide');
  const dir = sim.get('dir');
  // The carve-mode answers: veg (may this column spare vegetation?) and
  // retro (a slope just started -- both engines consume the flag and reset
  // it to 0 after retro-clearing, mirrored here).
  const veg = sim.get('veg');
  const retro = sim.get('retro');
  sim.set('retro', 0);

  const railYBefore = S.railY;
  if (dir === -1) S.railY -= 1;
  else if (dir === 1) S.railY += 1;
  S.headX += 1;
  S.track.push(S.railY);
  return { dir, target, railYBefore, veg, retro };
}

function runRide(fnDir, prefix, surface, columns) {
  const sim = new Sim(fnDir, prefix);
  sim.call('config');
  const cfg = Object.fromEntries(CFG_KEYS.map((k) => [k, sim.get(k)]));
  sim.set('slope', 0);
  sim.set('flat', 99);
  sim.set('lastDir', 0);
  sim.set('vclear', 0);
  sim.set('retro', 0);
  const startRailY = surface(0) + cfg.HOVER;
  const S = { headX: 0, railY: startRailY, avg: surface(0), track: [startRailY] };
  const log = [];
  for (let i = 0; i < columns; i++) log.push(advance(sim, S, surface, cfg));
  return { S, log, cfg };
}

// ---------------------------------------------------------------------------
// Terrains + invariant checks
// ---------------------------------------------------------------------------
// settles: the surface is constant over the tail of the run, so the rail must
// have converged onto terrain + HOVER by the end. Non-settling terrains
// (rolling hills, a sawtooth rising faster than #SAMEGAP allows climbing) are
// SUPPOSED to leave the rail chasing/tunneling, so only the structural
// invariants apply there.
const TERRAINS = {
  flat: { settles: true, f: () => 64 },
  plateau: { settles: true, f: (x) => (x < 120 ? 64 : 96) },            // one big climb
  valley: { settles: true, f: (x) => (x >= 150 && x < 300 ? 34 : 64) }, // one wide basin
  ravine: { settles: true, f: (x) => (x >= 200 && x < 210 ? 20 : 64) }, // narrow slot canyon
  rolling: { settles: false, f: (x) => 64 + Math.round(10 * Math.sin(x / 40) + 6 * Math.sin(x / 97)) },
  mountain: { settles: false, f: (x) => 64 + Math.max(0, Math.round((x - 100) / 3) % 60) },
};

function checkInvariants(name, ride, settles) {
  const { log, cfg, S } = ride;
  // Mirror the algorithm's own #flat accounting exactly: end_event zeroes the
  // counter ON the event-ending flat column, and each subsequent flat column
  // adds 1 -- so at an event-start column, `flats` equals the #flat the shared
  // brain compared against #SAMEGAP/#TURNGAP.
  let flats = 99, lastDir = 0, inEvent = 0, vbuf = 0;
  log.forEach((step, i) => {
    const { dir, veg, retro } = step;
    // Mirror the carve-mode contract: #retro fires exactly on event-start
    // columns; #veg is 0 on every slope column and for #SLOPECLEAR flat
    // columns after an event ends (counting the landing column), 1 elsewhere.
    const starting = dir !== 0 && inEvent === 0;
    if (retro !== (starting ? 1 : 0)) {
      fail(`${name}: #retro was ${retro} at column ${i} (${starting ? 'event start' : 'no event start'})`);
    }
    if (dir === 0 && inEvent !== 0) vbuf = cfg.SLOPECLEAR; // end_event armed the buffer
    const expectVeg = dir !== 0 || vbuf > 0 ? 0 : 1;
    if (veg !== expectVeg) fail(`${name}: #veg was ${veg} at column ${i} (expected ${expectVeg})`);
    if (dir === 0 && vbuf > 0) vbuf -= 1;

    if (dir !== 0) {
      if (inEvent !== 0 && dir !== inEvent) fail(`${name}: direction flip inside an event at column ${i}`);
      if (inEvent === 0) {
        // event start: check the deadband and the gap the brain just approved
        const need = dir === lastDir ? cfg.SAMEGAP : cfg.TURNGAP;
        if (flats < need) fail(`${name}: event started after ${flats} flat columns (needed ${need}) at column ${i}`);
        const diff = Math.abs(step.target - step.railYBefore);
        if (diff < cfg.DEADBAND) fail(`${name}: event started with |target-railY|=${diff} < DEADBAND=${cfg.DEADBAND} at column ${i}`);
        inEvent = dir;
        lastDir = dir;
      }
      flats = 0;
    } else {
      flats = inEvent !== 0 ? 0 : flats + 1; // ending column resets, like end_event
      inEvent = 0;
    }
  });

  // On terrain that settles, the rail must have converged to within the
  // deadband of the sampled target by the end of the run.
  if (settles) {
    const last = log[log.length - 1];
    const drift = Math.abs(last.target - S.railY);
    if (drift >= cfg.DEADBAND + 1) fail(`${name}: rail ended ${drift} blocks from target`);
  }
}

// ---------------------------------------------------------------------------
// The smooth-camera guarantees, exercised on the SHIPPED cam_math module over
// each ride's actual recorded profile, with the ride's own config knobs.
// ---------------------------------------------------------------------------
function checkCamera(name, ride) {
  const { cfg, S } = ride;
  const trackY = S.track;
  const lift = cfg.CAMLIFT / 10;
  let s2 = trackY[0];
  let flatRun = 0, climbRun = 0;
  for (let px = 0; px < trackY.length - 80; px += 0.4) {
    const maxi = trackY.length - 1;
    const fx = px - Math.floor(px);
    const index = Math.min(Math.max(Math.floor(px) + cfg.CAMAHEAD, 0), maxi);
    const r = camHeight({
      trackY, index, fx,
      lift10: cfg.CAMLIFT, blend: cfg.CAMBLEND, smooth: cfg.CAMSMOOTH, s2,
    });
    s2 = r.s2;
    if (Number.isNaN(r.sy)) return fail(`${name}: camera height NaN at pace ${px}`);
    if (r.sy < r.line - 1e-9) return fail(`${name}: camera sank below the rail line at pace ${px}`);
    const level = (i) => trackY[Math.min(Math.max(i, 0), maxi)];
    const isFlat = (i, span) => {
      for (let d = -span; d <= span; d++) if (level(i + d) !== level(i)) return false;
      return true;
    };
    // On long-settled flats the construction must reproduce the line exactly.
    if (isFlat(index, 12)) { flatRun += 1; } else { flatRun = 0; }
    if (flatRun > 200 && Math.abs(r.sy - r.line) > 0.05) {
      return fail(`${name}: camera not level on a settled flat at pace ${px} (off by ${(r.sy - r.line).toFixed(3)})`);
    }
    // Mid-climb (45 degrees on both sides) it must ride parallel at +lift.
    const climbing = level(index + 6) - level(index) === 6 && level(index) - level(index - 6) === 6;
    if (climbing) { climbRun += 1; } else { climbRun = 0; }
    if (climbRun > 40) {
      const above = r.sy - r.line;
      if (above < lift - 0.5 || above > lift + 0.5) {
        return fail(`${name}: mid-climb camera not parallel at +CAMLIFT (offset ${above.toFixed(3)}, lift ${lift}) at pace ${px}`);
      }
    }
  }
  ok(`${name}: camera construction holds (floor, flats, parallel climbs)`);
}

// ---------------------------------------------------------------------------
// Run everything
// ---------------------------------------------------------------------------
const COLUMNS = 600;
console.log('Simulating the shared event-model brain (emitted Java copy vs emitted Bedrock copy):');
for (const [name, { settles, f: surface }] of Object.entries(TERRAINS)) {
  const java = runRide(JAVA_FN, '#', surface, COLUMNS);
  const bedrock = runRide(BEDROCK_FN, '.', surface, COLUMNS);

  const jDirs = java.log.map((s) => s.dir).join('');
  const bDirs = bedrock.log.map((s) => s.dir).join('');
  if (jDirs !== bDirs) fail(`${name}: Java and Bedrock copies diverged`);
  else ok(`${name}: Java and Bedrock decisions identical over ${COLUMNS} columns (${java.log.filter((s) => s.dir !== 0).length} sloped)`);

  checkInvariants(name, java, settles);
  checkCamera(name, java);
}

if (failures > 0) {
  console.error(`\n${failures} simulation check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll simulation checks passed.');
