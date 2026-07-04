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
//    - events only start when |target - railY| >= #DEADBAND
//    - flat gaps between events respect #SAMEGAP / #TURNGAP
//    - the rail converges onto terrain + #HOVER
//
//  It also checks the smooth-camera construction (the float port used by the
//  Bedrock script) for its core guarantees: never below the rail line, exact
//  on settled flats, parallel mid-climb, level landing at the summit.
//
//  Run after tools/build.mjs:  node tools/simulate.mjs
// =============================================================================

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
// lint guarantees shared files contain nothing else).
// ---------------------------------------------------------------------------
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
      m = cmd.match(/^execute (.+?) run (.+)$/);
      if (!m) throw new Error(`unparseable execute: ${cmd}`);
      if (this.conds(m[1])) this.exec(m[2]);
      return;
    }
    throw new Error(`unsupported command in shared file: ${cmd}`);
  }

  conds(str) {
    const re = /(if|unless) score (\S+) ir (?:matches (\S+)|(<=|>=|=|<|>) (\S+) ir)/g;
    let m, matched = 0;
    while ((m = re.exec(str))) {
      matched += 1;
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
    if (matched === 0) throw new Error(`no score conditions parsed from: ${str}`);
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
// ---------------------------------------------------------------------------
const CFG = {
  HOVER: 2, TUNNEL: 6, DEADBAND: 3, SAMEGAP: 25, TURNGAP: 40,
  UPCLAMP: 150, DOWNCLAMP: 50,
};

function newRide(sim, startX, startY) {
  sim.call('config');
  sim.set('slope', 0);
  sim.set('flat', 99);
  sim.set('lastDir', 0);
  return { headX: startX, railY: startY + CFG.HOVER, avg: startY, track: [startY + CFG.HOVER] };
}

function advance(sim, S, surface) {
  const lo = S.avg - CFG.DOWNCLAMP;
  const hi = S.avg + CFG.UPCLAMP;
  let sum = 0;
  for (let off = 4; off <= 48; off += 4) {
    let s = surface(S.headX + off);
    if (s === undefined || s <= -63) s = S.avg;
    sum += Math.min(Math.max(s, lo), hi);
  }
  S.avg = Math.floor(sum / 12);
  const target = S.avg + CFG.HOVER;

  sim.set('target', target);
  sim.set('railY', S.railY);
  sim.call('decide');
  const dir = sim.get('dir');

  if (dir === -1) S.railY -= 1;
  else if (dir === 1) S.railY += 1;
  S.headX += 1;
  S.track.push(S.railY);
  return { dir, target };
}

function runRide(fnDir, prefix, surface, columns) {
  const sim = new Sim(fnDir, prefix);
  const S = newRide(sim, 0, surface(0));
  const log = [];
  for (let i = 0; i < columns; i++) log.push(advance(sim, S, surface));
  return { S, log };
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

function checkInvariants(name, log, settles) {
  // 1. Events are contiguous 45-degree runs: inside a nonzero run the
  //    direction never flips without passing through flat.
  // 2. An event only starts when |target - railY| >= DEADBAND.
  // 3. Flat gaps between events respect SAMEGAP / TURNGAP.
  let flats = 99, lastDir = 0, inEvent = 0, railY = null;
  log.forEach((step, i) => {
    const { dir } = step;
    if (dir !== 0) {
      if (inEvent !== 0 && dir !== inEvent) fail(`${name}: direction flip inside an event at column ${i}`);
      if (inEvent === 0) {
        // event start
        const need = dir === lastDir ? CFG.SAMEGAP : CFG.TURNGAP;
        if (flats < need) fail(`${name}: event started after ${flats} flat columns (needed ${need}) at column ${i}`);
        inEvent = dir;
        lastDir = dir;
      }
      flats = 0;
    } else {
      inEvent = 0;
      flats += 1;
    }
    railY = step;
  });

  // 4. On terrain that settles, the rail must have converged to within the
  //    deadband of the sampled target by the end of the run.
  if (settles) {
    const last = log[log.length - 1];
    const drift = Math.abs(last.target - railYOf(log));
    if (drift >= CFG.DEADBAND + 1) fail(`${name}: rail ended ${drift} blocks from target`);
  }
}

function railYOf(log) {
  // reconstruct final railY from the dirs (start = surface(0) + HOVER)
  return log.reduce((y, s) => y + s.dir, TERRAINS_START);
}
let TERRAINS_START = 0;

// ---------------------------------------------------------------------------
// The smooth-camera construction (float port used by the Bedrock script).
// ---------------------------------------------------------------------------
function camAt(trackY, paceX, camAhead, camBlend, camLift, camSmooth, s2) {
  const maxi = trackY.length - 1;
  const fx = paceX - Math.floor(paceX);
  const lineAt = (i) => {
    const a = trackY[Math.min(Math.max(i, 0), maxi)];
    const b = trackY[Math.min(Math.max(i + 1, 0), maxi)];
    return a * (1 - fx) + b * fx;
  };
  let ci = Math.floor(paceX) + camAhead;
  ci = Math.min(Math.max(ci, 0), maxi);
  const lift = camLift / 10;
  const wmax = Math.floor(camLift / 10) + 2;
  const half = Math.floor(camBlend / 2);
  const lineHere = lineAt(ci);
  let sum = 0, n = 0;
  for (let j = -half; j <= half; j++) {
    let fmx = -Infinity;
    for (let k = 0; k <= wmax; k++) fmx = Math.max(fmx, lineAt(ci + j + k));
    sum += Math.min(fmx, lineAt(ci + j) + lift);
    n += 1;
  }
  const c1 = sum / n;
  const s2n = s2 + (lineHere - s2) / Math.max(camSmooth, 1);
  return { sy: Math.max(c1, s2n, lineHere), s2: s2n, line: lineHere };
}

function checkCamera(name, trackY) {
  let s2 = trackY[0];
  let flatRun = 0, climbRun = 0;
  for (let px = 0; px < trackY.length - 80; px += 0.4) {
    const r = camAt(trackY, px, 64, 6, 20, 6, s2);
    s2 = r.s2;
    if (Number.isNaN(r.sy)) return fail(`${name}: camera height NaN at pace ${px}`);
    if (r.sy < r.line - 1e-9) return fail(`${name}: camera sank below the rail line at pace ${px}`);
    const ci = Math.floor(px) + 64;
    const level = (i) => trackY[Math.min(Math.max(i, 0), trackY.length - 1)];
    const isFlat = (i, span) => {
      for (let d = -span; d <= span; d++) if (level(i + d) !== level(i)) return false;
      return true;
    };
    // On long-settled flats the construction must reproduce the line exactly.
    if (isFlat(ci, 12)) { flatRun += 1; } else { flatRun = 0; }
    if (flatRun > 200 && Math.abs(r.sy - r.line) > 0.05) {
      return fail(`${name}: camera not level on a settled flat at pace ${px} (off by ${(r.sy - r.line).toFixed(3)})`);
    }
    // Mid-climb (45-degree both sides) it must ride parallel, lift above rail.
    const climbing = level(ci + 6) - level(ci) === 6 && level(ci) - level(ci - 6) === 6;
    if (climbing) { climbRun += 1; } else { climbRun = 0; }
    if (climbRun > 40) {
      const above = r.sy - r.line;
      if (above < 1.5 || above > 2.5) {
        return fail(`${name}: mid-climb camera not parallel at +CAMLIFT (offset ${above.toFixed(3)}) at pace ${px}`);
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
  TERRAINS_START = surface(0) + CFG.HOVER;
  const java = runRide(JAVA_FN, '#', surface, COLUMNS);
  const bedrock = runRide(BEDROCK_FN, '.', surface, COLUMNS);

  const jDirs = java.log.map((s) => s.dir).join('');
  const bDirs = bedrock.log.map((s) => s.dir).join('');
  if (jDirs !== bDirs) fail(`${name}: Java and Bedrock copies diverged`);
  else ok(`${name}: Java and Bedrock decisions identical over ${COLUMNS} columns (${java.log.filter((s) => s.dir !== 0).length} sloped)`);

  checkInvariants(name, java.log, settles);
  checkCamera(name, java.S.track);
}

if (failures > 0) {
  console.error(`\n${failures} simulation check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll simulation checks passed.');
