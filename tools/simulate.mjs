#!/usr/bin/env node
// =============================================================================
//  Infinite Rail logic simulator / regression test
//
//  Runs the ACTUAL shared .mcfunction files emitted by the build (the Java
//  copy and the Bedrock copy -- byte-identical by construction, but each
//  resolved through its OWN edition's ir_* call-bridge trampolines) through a
//  tiny interpreter of the shared dual-dialect command subset, drives them
//  with the same per-column pipeline the engines use (sample window ->
//  decide -> place), and asserts the event-model invariants on synthetic
//  terrains:
//
//    - the two edition copies make IDENTICAL decisions column for column
//    - climbs are contiguous 45-degree events; descents are monotone and may
//      hold level mid-event ONLY as ground-contact pauses (never stalling
//      with a clear floor below)
//    - events only start when |target - railY| >= #DEADBAND (checked exactly;
//      a climb may also start at diff >= 1 on near-scan ground contact)
//    - flat gaps between events respect #SAMEGAP / #TURNGAP (exact counting)
//    - descents never step below the grace floor (the TALLEST near-scan
//      surface + #DOWNGRACE -- no trenching), and never start without
//      two-step runway
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
// Each edition resolves a function name across two directories: the
// infinite_rail functions themselves, plus the edition's home for the bare
// ir_* call bridges (Java: the minecraft namespace; Bedrock: functions/ root).
const JAVA_FN = [
  join(ROOT, 'dist', 'java', 'infinite_rail', 'data', 'infinite_rail', 'function'),
  join(ROOT, 'dist', 'java', 'infinite_rail', 'data', 'minecraft', 'function'),
];
const BEDROCK_FN = [
  join(ROOT, 'dist', 'bedrock', 'InfiniteRail_BP', 'functions', 'infinite_rail'),
  join(ROOT, 'dist', 'bedrock', 'InfiniteRail_BP', 'functions'),
];

let failures = 0;
const fail = (msg) => { failures += 1; console.error(`  FAIL: ${msg}`); };
const ok = (msg) => console.log(`  ok: ${msg}`);

if (![...JAVA_FN, ...BEDROCK_FN].every((d) => existsSync(d))) {
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
  constructor(fnDirs) {
    this.fnDirs = fnDirs;
    this.scores = new Map();
    this.fns = new Map();
  }

  load(name) {
    if (!this.fns.has(name)) {
      const dir = this.fnDirs.find((d) => existsSync(join(d, `${name}.mcfunction`)));
      if (!dir) throw new Error(`function not found in any dir: ${name}`);
      const text = readFileSync(join(dir, `${name}.mcfunction`), 'utf8');
      this.fns.set(name, text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')));
    }
    return this.fns.get(name);
  }

  get(name) { return this.scores.get(`.${name}`) ?? 0; }
  set(name, v) { this.scores.set(`.${name}`, v | 0); }

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
    // Namespaced/path calls (edition-native files, e.g. the bridges) and the
    // shared files' bare ir_* bridge calls all resolve through load().
    if ((m = cmd.match(/^function (?:infinite_rail[:/])?([a-z0-9_]+)$/))) {
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
  'UPLOOK', 'UPGRACE', 'DOWNLOOK', 'DOWNGRACE',
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

  // The near-ground scan (Java's near_scan/near_step, Bedrock's nearScan):
  // the HIGHEST surface at odd offsets +1, +3, ... within .DOWNLOOK (the
  // descent guard's floor basis) and .UPLOOK (the climb contact trigger),
  // -10000 when a window is 0 or returned no generated terrain (fail-open).
  const w = Math.min(48, Math.max(cfg.UPLOOK, cfg.DOWNLOOK));
  let gfloor = null;
  let gmax = null;
  for (let off = 1; off <= w; off += 2) {
    const s = surface(S.headX + off);
    if (s === undefined || s <= -63) continue;
    if (off <= cfg.DOWNLOOK && (gfloor === null || s > gfloor)) gfloor = s;
    if (off <= cfg.UPLOOK && (gmax === null || s > gmax)) gmax = s;
  }
  gfloor ??= -10000;
  gmax ??= -10000;

  sim.set('target', target);
  sim.set('railY', S.railY);
  sim.set('gfloor', gfloor);
  sim.set('gmax', gmax);
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
  return { dir, target, railYBefore, veg, retro, gfloor, gmax };
}

function runRide(fnDirs, surface, columns) {
  const sim = new Sim(fnDirs);
  sim.call('config');
  const cfg = Object.fromEntries(CFG_KEYS.map((k) => [k, sim.get(k)]));
  sim.set('slope', 0);
  sim.set('flat', 99);
  sim.set('lastDir', 0);
  sim.set('vclear', 0);
  sim.set('retro', 0);
  sim.set('SKYMODE', 0); // modes_init seeds this on both engines
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
  // A high tabletop with a sheer drop-off: the descent dig-guard must hold the
  // line level to the edge instead of trenching down through the tabletop
  // early to chase the (already low) forward average. See checkMesa.
  mesa: { settles: true, f: (x) => (x < 200 ? 64 : x < 320 ? 89 : 64) },
  // A narrow 10-high ridge the 12-sample average dilutes to diff=1 (inside
  // the deadband): only the early-climb ground-contact rule reacts, starting
  // a climb below #DEADBAND and crest-pushing #UPGRACE past the target --
  // exercises the contact-start path of the invariant checks.
  ridge: { settles: true, f: (x) => (x >= 300 && x < 308 ? 74 : 64) },
  // A long 1:2 downhill face: the descent must hug it as a pause-resume
  // staircase without ever stepping below the surface -- the old min-window
  // floor let 45-degree descents knife several blocks into the face.
  hillside: { settles: true, f: (x) => (x < 150 ? 96 : Math.max(64, 96 - Math.floor((x - 150) / 2))) },
};

function checkInvariants(name, ride, settles) {
  const { log, cfg, S } = ride;
  // Mirror the algorithm's own #flat accounting exactly: end_event zeroes the
  // counter ON the event-ending flat column, and each subsequent flat column
  // adds 1 -- so at an event-start column, `flats` equals the #flat the shared
  // brain compared against #SAMEGAP/#TURNGAP.
  let flats = 99, lastDir = 0, inEvent = 0, vbuf = 0;
  log.forEach((step, i) => {
    const { dir, veg, retro, gfloor, gmax } = step;
    const diff = step.target - step.railYBefore;
    const floorReal = cfg.DOWNLOOK >= 1 && gfloor > -10000;
    const digNow = floorReal && step.railYBefore - 1 < gfloor + cfg.DOWNGRACE;

    // A dir=0 column during a descent is either a PAUSE (the descent still
    // wants to go lower but the next step would land below the grace floor
    // -- the event stays open, mirroring decide's own rule) or the event's
    // end. A descent that answers 0 while it wants down AND the floor is
    // clear has stalled for no reason -- that's a brain bug.
    const paused = dir === 0 && inEvent === -1 && diff <= -1 && digNow;
    if (dir === 0 && inEvent === -1 && diff <= -1 && !digNow) {
      fail(`${name}: descent stalled without ground contact at column ${i}`);
    }

    // Mirror the carve-mode contract: #retro fires exactly on event-start
    // columns; #veg is 0 on every slope column, on every PAUSED descent
    // column (the event is still open -- the camera floats there), and for
    // #SLOPECLEAR flat columns after an event ends, 1 elsewhere.
    const starting = dir !== 0 && inEvent === 0;
    if (retro !== (starting ? 1 : 0)) {
      fail(`${name}: #retro was ${retro} at column ${i} (${starting ? 'event start' : 'no event start'})`);
    }
    if (dir === 0 && inEvent !== 0 && !paused) vbuf = cfg.SLOPECLEAR; // end_event armed the buffer
    const expectVeg = dir !== 0 || paused || vbuf > 0 ? 0 : 1;
    if (veg !== expectVeg) fail(`${name}: #veg was ${veg} at column ${i} (expected ${expectVeg})`);
    if (dir === 0 && !paused && vbuf > 0) vbuf -= 1;

    if (dir !== 0) {
      if (inEvent !== 0 && dir !== inEvent) fail(`${name}: direction flip inside an event at column ${i}`);
      // The descent dig-guard: no descending column may ever land the rail
      // below the grace floor (the TALLEST scanned surface + #DOWNGRACE) --
      // descents physically cannot trench.
      if (dir === -1 && digNow) {
        fail(`${name}: descent stepped below the grace floor (rail ${step.railYBefore - 1} < ${gfloor}+${cfg.DOWNGRACE}) at column ${i}`);
      }
      if (inEvent === 0) {
        // event start: check the deadband and the gap the brain just approved
        const need = dir === lastDir ? cfg.SAMEGAP : cfg.TURNGAP;
        if (flats < need) fail(`${name}: event started after ${flats} flat columns (needed ${need}) at column ${i}`);
        if (dir === 1) {
          // A climb may also start inside the deadband on ground contact
          // (diff >= 1 and the near scan sees terrain above the rail).
          const contact = cfg.UPLOOK >= 1 && diff >= 1 && gmax > step.railYBefore;
          if (diff < cfg.DEADBAND && !contact) {
            fail(`${name}: climb started with diff=${diff} < DEADBAND=${cfg.DEADBAND} and no ground contact at column ${i}`);
          }
        } else {
          if (-diff < cfg.DEADBAND) fail(`${name}: descent started with diff=${diff} inside DEADBAND=${cfg.DEADBAND} at column ${i}`);
          // Descent starts additionally need clear runway for at least two
          // steps above the grace floor (decide's #dig2 veto).
          if (floorReal && step.railYBefore - 2 < gfloor + cfg.DOWNGRACE) {
            fail(`${name}: descent started without two-step room above the grace floor at column ${i}`);
          }
        }
        inEvent = dir;
        lastDir = dir;
      }
      flats = 0;
    } else if (paused) {
      flats = 0; // the event stays open; gap counting stays frozen
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

// The mesa's specific promise (the descent guard): once the line has crested
// onto the tabletop it never goes below the tabletop surface again until the
// drop-off at x=320 -- the descent start is vetoed until the whole #DOWNLOOK
// runway is past the edge, so there is no early trench and no rim notch at
// all. (The old average-chasing behavior started the descent ~45 columns
// early and trenched down through the tabletop to get a head start on the
// valley beyond.)
function checkMesa(ride) {
  const { S, cfg } = ride;
  if (cfg.DOWNLOOK < 1) return;
  const top = 89; // the mesa terrain's tabletop surface
  let crest = -1;
  for (let x = 200; x <= 280; x++) {
    if (S.track[x] >= top + cfg.HOVER) { crest = x; break; }
  }
  if (crest < 0) return fail('mesa: the line never reached cruising height over the tabletop');
  for (let x = crest; x <= 319; x++) {
    if (S.track[x] < top) {
      return fail(`mesa: the rail dipped into the tabletop (railY ${S.track[x]} < ${top} at x=${x})`);
    }
  }
  ok(`mesa: rides the tabletop level (from x=${crest}) and descends only at the drop-off`);
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
  const java = runRide(JAVA_FN, surface, COLUMNS);
  const bedrock = runRide(BEDROCK_FN, surface, COLUMNS);

  const jDirs = java.log.map((s) => s.dir).join('');
  const bDirs = bedrock.log.map((s) => s.dir).join('');
  if (jDirs !== bDirs) fail(`${name}: Java and Bedrock copies diverged`);
  else ok(`${name}: Java and Bedrock decisions identical over ${COLUMNS} columns (${java.log.filter((s) => s.dir !== 0).length} sloped)`);

  checkInvariants(name, java, settles);
  checkCamera(name, java);
  if (name === 'mesa') checkMesa(java);
}

// ---------------------------------------------------------------------------
// Sky mode: with #SKYMODE set, the shared decide must override the terrain
// target with the fixed #SKYY altitude -- one contiguous 45-degree climb up,
// dead-level cruising at exactly #SKYY, and a glide back down onto the
// terrain-following line once the mode is toggled off. Exercises the mode
// override line in decide on both emitted copies.
// ---------------------------------------------------------------------------
console.log('\nSimulating sky mode (the fixed-altitude #SKYY override in the shared decide):');
{
  const SKYY = 200;
  const surface = TERRAINS.rolling.f; // rolling hills around Y 48..80
  const dirsByEdition = [];
  for (const [label, fnDirs] of [['java', JAVA_FN], ['bedrock', BEDROCK_FN]]) {
    const sim = new Sim(fnDirs);
    sim.call('config');
    const cfg = Object.fromEntries(CFG_KEYS.map((k) => [k, sim.get(k)]));
    sim.set('slope', 0);
    sim.set('flat', 99);
    sim.set('lastDir', 0);
    sim.set('vclear', 0);
    sim.set('retro', 0);
    sim.set('SKYMODE', 1);
    sim.set('SKYY', SKYY);
    const startY = surface(0) + cfg.HOVER;
    const S = { headX: 0, railY: startY, avg: surface(0), track: [startY] };
    const log = [];
    for (let i = 0; i < 400; i++) log.push(advance(sim, S, surface, cfg));
    if (S.railY !== SKYY) fail(`sky/${label}: rail ended at Y=${S.railY}, wanted exactly ${SKYY}`);
    const climbDirs = log.map((s) => s.dir).join('');
    if (!/^0*1+0+$/.test(climbDirs)) fail(`sky/${label}: the climb to #SKYY was not one contiguous 45-degree event`);
    sim.set('SKYMODE', 0); // toggle off: the rail must glide back to the terrain
    for (let i = 0; i < 400; i++) log.push(advance(sim, S, surface, cfg));
    if (S.railY > 90) fail(`sky/${label}: rail did not descend after toggling sky mode off (Y=${S.railY})`);
    dirsByEdition.push(log.map((s) => s.dir).join(''));
  }
  if (dirsByEdition[0] !== dirsByEdition[1]) fail('sky: Java and Bedrock copies diverged');
  else ok(`sky: climbs to ${SKYY} in one event, holds level, and glides back down after toggle-off (editions identical)`);
}

if (failures > 0) {
  console.error(`\n${failures} simulation check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll simulation checks passed.');
