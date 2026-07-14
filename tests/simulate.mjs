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
//    - every elevation change is one contiguous 45-degree event
//    - events only start when |target - railY| >= #MIN_CHANGE (checked exactly;
//      a climb may also start at diff >= 1 on near-scan ground contact)
//    - climbs never start ahead of schedule (the 45-degree cone, less #PLOW_GRACE_UP)
//    - flat gaps between events respect #SAMEGAP / #TURNGAP_TOP / #TURNGAP_BOTTOM minus the
//      big-event gap credit (#GAPRATIO / #GAPMATCH -- a large previous event
//      shortens the next gap) and minus the descent shift (#SHIFT_REQ_BOTTOM -- a
//      scan-verified descent onto a landing stretch jumps its gap outright),
//      recomputed exactly; and on the purpose-built terrains both must
//      actually engage at least once, without splitting the shifted descent
//    - descents never step below the descent floor (the TALLEST near-scan
//      surface - #PLOW_GRACE_DOWN -- no trenching), never start without two-step
//      runway, and never end while the floor below is still clear
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
//  Run after tools/build.mjs:  node tests/simulate.mjs
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
  join(ROOT, 'dist', 'java', 'Scenic_Infinite_Rail_Mode', 'data', 'infinite_rail', 'function'),
  join(ROOT, 'dist', 'java', 'Scenic_Infinite_Rail_Mode', 'data', 'minecraft', 'function'),
];
const BEDROCK_FN = [
  join(ROOT, 'dist', 'bedrock', 'Scenic_Infinite_Rail_Mode_BP', 'functions', 'infinite_rail'),
  join(ROOT, 'dist', 'bedrock', 'Scenic_Infinite_Rail_Mode_BP', 'functions'),
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
//
// Scores are tracked PER OBJECTIVE (keyed "objective NAME"): the tunables
// live in the three cfg_* objectives while runtime state stays in `ir`, and
// a shared file reading a knob from the wrong objective must show up here as
// the zero it would read in game, never be papered over by a flat namespace.
// ---------------------------------------------------------------------------
const CONDS_RE = /^(?:(?:if|unless) score \S+ \S+ (?:matches \S+|(?:<=|>=|=|<|>) \S+ \S+) )+$/;

class Sim {
  constructor(fnDirs) {
    this.fnDirs = fnDirs;
    this.scores = new Map(); // "objective NAME" -> value
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

  get(name, obj = 'ir') { return this.scores.get(`${obj} .${name}`) ?? 0; }
  set(name, v, obj = 'ir') { this.scores.set(`${obj} .${name}`, v | 0); }

  call(name) { for (const line of this.load(name)) this.exec(line); }

  exec(cmd) {
    let m;
    if ((m = cmd.match(/^scoreboard players (set|add|remove) (\S+) (\S+) (-?\d+)$/))) {
      const [, op, who, obj, val] = m;
      const key = `${obj} ${who}`;
      const v = parseInt(val, 10);
      const cur = this.scores.get(key) ?? 0;
      this.scores.set(key, op === 'set' ? v : op === 'add' ? cur + v : cur - v);
      return;
    }
    if ((m = cmd.match(/^scoreboard players reset (\S+)(?: (\S+))?$/))) {
      const [, who, obj] = m;
      if (obj) this.scores.delete(`${obj} ${who}`);
      else for (const k of [...this.scores.keys()]) {
        if (k.endsWith(` ${who}`)) this.scores.delete(k);
      }
      return;
    }
    if ((m = cmd.match(/^scoreboard players operation (\S+) (\S+) (=|\+=|-=|\*=|\/=|%=|<|>|><) (\S+) (\S+)$/))) {
      const [, a, aObj, op, b, bObj] = m;
      const aKey = `${aObj} ${a}`;
      const bKey = `${bObj} ${b}`;
      const av = this.scores.get(aKey) ?? 0;
      const bv = this.scores.get(bKey) ?? 0;
      const floordiv = (x, y) => Math.floor(x / y);
      const r = { '=': bv, '+=': av + bv, '-=': av - bv, '*=': av * bv,
        '/=': floordiv(av, bv), '%=': av - floordiv(av, bv) * bv,
        '<': Math.min(av, bv), '>': Math.max(av, bv), '><': bv }[op];
      this.scores.set(aKey, r | 0);
      if (op === '><') this.scores.set(bKey, av | 0);
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
    const re = /(if|unless) score (\S+) (\S+) (?:matches (\S+)|(<=|>=|=|<|>) (\S+) (\S+))/g;
    let m;
    while ((m = re.exec(str))) {
      const [, kind, who, obj, range, cmp, other, otherObj] = m;
      const v = this.scores.get(`${obj} ${who}`) ?? 0;
      let pass;
      if (range !== undefined) pass = inRange(v, range);
      else {
        const o = this.scores.get(`${otherObj} ${other}`) ?? 0;
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
const CFG_KEYS = ['HOVER', 'MIN_CHANGE', 'SAMEGAP', 'TURNGAP_TOP', 'TURNGAP_BOTTOM',
  'GAPRATIO', 'GAPMATCH',
  'SHIFT_REQ_BOTTOM', 'DOWNCLAMP', 'UPGRACE', 'PLOW_GRACE_UP', 'PLOW_GRACE_DOWN',
  'DOWNLOOK_AHEAD', 'SAMPLE_WINDOW', 'SAMPLE_BLOCK_INTERVAL',
  'CAMBLEND', 'CAMLIFT', 'CAMSMOOTH', 'RIDER_BEHIND', 'PACE_CART_BEHIND',
  'SLOPECLEAR'];
// The objective each knob lives in (the config split -- must match
// config.mcfunction; camera knobs + .RIDER_BEHIND live in cfg_camera,
// .SHIFT_REQ_BOTTOM and .PACE_CART_BEHIND in cfg_ride,
// .SAMPLE_BLOCK_INTERVAL in `ir`, the rest of CFG_KEYS in
// cfg_terrain, and the sky knobs used by the sky-mode test in cfg_ride).
const CFG_OBJ = Object.fromEntries(CFG_KEYS.map((k) => [
  k, k.startsWith('CAM') || k === 'RIDER_BEHIND' ? 'cfg_camera'
    : k === 'SHIFT_REQ_BOTTOM' || k === 'PACE_CART_BEHIND' ? 'cfg_ride'
      : k === 'SAMPLE_BLOCK_INTERVAL' ? 'ir' : 'cfg_terrain',
]));
const readCfg = (sim) => Object.fromEntries(CFG_KEYS.map((k) => [k, sim.get(k, CFG_OBJ[k])]));

function advance(sim, S, surface, cfg) {
  // One reading every SAMPLE_BLOCK_INTERVAL out to SAMPLE_WINDOW, the count
  // doubling as the divisor (Java's derived .winn; 12 at the defaults).
  // Down-clamped only -- terrain above the line registers at full height.
  const step = Math.max(1, cfg.SAMPLE_BLOCK_INTERVAL);
  const count = Math.max(1, Math.floor(cfg.SAMPLE_WINDOW / step));
  const lo = S.avg - cfg.DOWNCLAMP;
  let sum = 0;
  for (let i = 1; i <= count; i++) {
    let s = surface(S.headX + i * step);
    if (s === undefined || s <= -63) s = S.avg;
    sum += Math.max(s, lo);
  }
  S.avg = Math.floor(sum / count);
  const target = S.avg + cfg.HOVER;

  // The near-ground scan (Java's near_scan/near_step, Bedrock's nearScan),
  // at odd offsets +1, +3, ..., folded into PAIRS (min of two consecutive
  // probes -- erases 1-2 wide spikes like tree trunks): the highest pair
  // within .DOWNLOOK_AHEAD (the descent guard's floor basis) and anywhere
  // in the walk -- the climb side always scans the full sample window (the
  // climb contact trigger), plus the climb schedule .gcone -- over pairs
  // above railY - HOVER (ground actually in the way), the highest 45-degree
  // projection pair - near-distance. Sentinels: -10000 for the maxes and a
  // nothing-to-climb schedule (its gate holds); +32000 for a no-data
  // schedule (gate never holds -- plain average behavior).
  const w = Math.max(1, cfg.SAMPLE_WINDOW);
  const gbase = S.railY - cfg.HOVER;
  let gfloor = null;
  let gmax = null;
  let gcone = null;
  let valid = 0;
  let prev = null;
  for (let off = 1; off <= w; off += 2) {
    const s = surface(S.headX + off);
    if (s === undefined || s <= -63) { prev = null; continue; }
    valid += 1;
    if (prev !== null) {
      const pmin = Math.min(prev, s);
      const nd = off - 2;
      if (off <= cfg.DOWNLOOK_AHEAD && (gfloor === null || pmin > gfloor)) gfloor = pmin;
      if (gmax === null || pmin > gmax) gmax = pmin;
      if (pmin > gbase && (gcone === null || pmin - nd > gcone)) gcone = pmin - nd;
    }
    prev = s;
  }
  gfloor ??= -10000;
  gmax ??= -10000;
  gcone ??= valid === 0 ? 32000 : -10000;

  // The stretch-shift scan (Java's shift_scan/shift_step, Bedrock's
  // shiftScan; CONTEXT.md section 7l): while a wanted descent could be
  // gap-blocked, verify the whole plan ahead of time -- the shifted
  // 45-degree path must clear ground everywhere (beyond #PLOW_GRACE_DOWN
  // levels of cut-through), and the
  // landing must be a real stretch (ground at the landing level, within
  // #MIN_CHANGE under the hover line, for #SHIFT_REQ_BOTTOM columns; ground still
  // falling away fails). .sver = the verified horizon (0 = no/off); the
  // shared consider_start jumps the gap when it covers descent + stretch.
  let sver = 0;
  {
    const stretch = cfg.SHIFT_REQ_BOTTOM;
    const D = S.railY - target;
    const H = D + stretch;
    if (stretch >= 1 && D >= cfg.MIN_CHANGE && H <= 96) {
      const band = S.railY - D - cfg.HOVER - cfg.MIN_CHANGE;
      let sprev = null;
      for (let off = 1; off <= H + 1; off += 2) {
        const s = surface(S.headX + off);
        if (s === undefined || s <= -63) break;
        if (sprev !== null) {
          const pmin = Math.min(sprev, s);
          if (pmin > S.railY - Math.min(off, D) + cfg.PLOW_GRACE_DOWN) break;
          if (off > D && pmin < band) break;
          sver = off;
        }
        sprev = s;
      }
    }
  }

  sim.set('target', target);
  sim.set('railY', S.railY);
  sim.set('gfloor', gfloor);
  sim.set('gmax', gmax);
  sim.set('gcone', gcone);
  sim.set('sver', sver);
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
  return { dir, target, railYBefore, veg, retro, gfloor, gmax, gcone, sver };
}

function runRide(fnDirs, surface, columns) {
  const sim = new Sim(fnDirs);
  sim.call('consts'); // .C100, the credit's percent divisor (both engines run it at load)
  sim.call('config');
  const cfg = readCfg(sim);
  sim.set('slope', 0);
  sim.set('flat', 99);
  sim.set('lastDir', 0);
  sim.set('evrun', 0);
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
  // a climb below #MIN_CHANGE and crest-pushing #UPGRACE past the target --
  // exercises the contact-start path of the invariant checks.
  ridge: { settles: true, f: (x) => (x >= 300 && x < 308 ? 74 : 64) },
  // A long 1:2 downhill face: descents must come down it in gap-paced
  // 45-degree swoops that never enter the ground -- the old min-window
  // floor let them knife several blocks into the face.
  hillside: { settles: true, f: (x) => (x < 150 ? 96 : Math.max(64, 96 - Math.floor((x - 150) / 2))) },
  // A tall NARROW mountain (1:1 faces, 40 above the base plain): the ascent
  // is one big event, so the big-event gap credit must let the line REVERSE
  // and come back down before a full #TURNGAP_TOP of clifftop bridge has been
  // built past the summit (the loop below asserts a discounted reversal).
  // The long flat plain past x=280 is also the stretch shift's home case:
  // once the average converges onto the bottom, the verified plan (clear
  // path + a #SHIFT_REQ_BOTTOM landing bottom) must jump the remaining gap
  // entirely -- earlier than even the credit allows -- while still coming
  // down as ONE unbroken swoop (the loop below asserts both).
  peak: { settles: true, f: (x) => (x < 200 ? 64 : x < 240 ? 64 + (x - 200) : x < 280 ? 104 - (x - 240) : 64) },
  // One big ascent as two 35-block walls 80 apart: too tall for a single
  // event, so the second climb REPEATS the direction and is normally paced
  // by the full #SAMEGAP -- the credit earned by the first climb must let it
  // start sooner (the loop below asserts a discounted same-direction start).
  bigsteps: { settles: true, f: (x) => (x < 200 ? 64 : x < 280 ? 99 : 134) },
};

function checkInvariants(name, ride, settles) {
  const { log, cfg, S } = ride;
  // Mirror the algorithm's own #flat accounting exactly: end_event zeroes the
  // counter ON the event-ending flat column, and each subsequent flat column
  // adds 1 -- so at an event-start column, `flats` equals the #flat the shared
  // brain compared against #SAMEGAP/#TURNGAP_*. `run` mirrors #evrun (the last
  // event's sloped-column count = its height), the big-event gap credit's
  // input: at an event start the brain shrinks the required gap by
  // run * #GAPRATIO / 100 (the knobs are PERCENTS -- x100 fixed point, so
  // the ratios can be fractional on an int-only scoreboard), provided the
  // newly wanted move is itself at least run * #GAPMATCH / 100 blocks
  // (consider_start's credit block). The mirror
  // recomputes that exact discounted requirement, and counts the starts that
  // actually USED the credit (flats below the undiscounted gap) so the
  // purpose-built terrains can assert the feature engaged at all.
  let flats = 99, lastDir = 0, inEvent = 0, vbuf = 0, run = 0;
  const discounted = { same: 0, turn: 0, shift: 0 };
  log.forEach((step, i) => {
    const { dir, veg, retro, gfloor, gmax, gcone, sver } = step;
    const diff = step.target - step.railYBefore;
    const floorReal = cfg.DOWNLOOK_AHEAD >= 1 && gfloor > -10000;
    const digNow = floorReal && step.railYBefore - 1 < gfloor - cfg.PLOW_GRACE_DOWN;

    // A descent may only end while it still wants to go lower (diff <= -1)
    // if the next step would have landed below the descent floor -- ending
    // with a clear floor below would be an unmotivated stall.
    if (dir === 0 && inEvent === -1 && diff <= -1 && !digNow) {
      fail(`${name}: descent ended without ground contact at column ${i}`);
    }

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
      // The descent dig-guard: no descending column may ever land the rail
      // below the descent floor (the TALLEST scanned surface - #PLOW_GRACE_DOWN)
      // -- descents physically cannot trench.
      if (dir === -1 && digNow) {
        fail(`${name}: descent stepped below the descent floor (rail ${step.railYBefore - 1} < ${gfloor}-${cfg.PLOW_GRACE_DOWN}) at column ${i}`);
      }
      if (inEvent === 0) {
        // event start: check the deadband and the gap the brain just approved
        // -- the base #SAMEGAP/#TURNGAP_* minus the big-event gap credit
        // (run * #GAPRATIO / 100, guarded by the run * #GAPMATCH / 100
        // worth-it test, floored at 0 -- exactly consider_start's
        // arithmetic).
        const sameDir = dir === lastDir;
        const base = sameDir ? cfg.SAMEGAP
          : dir === 1 ? cfg.TURNGAP_BOTTOM : cfg.TURNGAP_TOP;
        let cut = cfg.GAPRATIO >= 1 ? Math.floor(run * cfg.GAPRATIO / 100) : 0;
        // The worth-it size of the wanted move: |diff|, except climbs also
        // consult the near scan (#gmax + #HOVER - railY) -- the average
        // dilutes an approaching rise to ~half, the contact reading is
        // honest (consider_start's .gup max; -10000 no-data loses the max).
        let mag = diff * dir;
        if (dir === 1) mag = Math.max(mag, gmax + cfg.HOVER - step.railYBefore);
        if (cfg.GAPMATCH >= 1 && mag < Math.floor(run * cfg.GAPMATCH / 100)) cut = 0;
        let need = Math.max(0, base - cut);
        // The descent shift: a scan-verified plan (the whole path + a
        // #SHIFT_REQ_BOTTOM landing bottom, .sver covering both) jumps
        // the gap entirely -- exactly consider_start's .swant comparison,
        // including its worth-it test (the descent must be at least
        // #GAPMATCH percent of the gap it is jumping).
        const shifted = dir === -1 && cfg.SHIFT_REQ_BOTTOM >= 1
          && sver >= -diff + cfg.SHIFT_REQ_BOTTOM
          && -diff >= Math.floor(need * cfg.GAPMATCH / 100);
        if (shifted) {
          if (flats < need) discounted.shift += 1;
          need = 0;
        }
        if (flats < need) fail(`${name}: event started after ${flats} flat columns (needed ${need} = ${base} - credit ${base - need}) at column ${i}`);
        if (flats < base) discounted[sameDir ? 'same' : 'turn'] += 1;
        if (dir === 1) {
          // A climb may also start inside the deadband on ground contact
          // (diff >= 1 and the near scan sees terrain above the rail).
          const contact = diff >= 1 && gmax > step.railYBefore; // the climb side is always on
          if (diff < cfg.MIN_CHANGE && !contact) {
            fail(`${name}: climb started with diff=${diff} < MIN_CHANGE=${cfg.MIN_CHANGE} and no ground contact at column ${i}`);
          }
          // The climb schedule: no climb may begin before it is due -- the
          // rail must already have reached the cone's demand (#HOVER above
          // it, less #PLOW_GRACE_UP) -- the highest
          // 45-degree-projected surface ahead (decide's #due gate).
          if (gcone < 32000
            && step.railYBefore >= gcone + cfg.HOVER - cfg.PLOW_GRACE_UP) {
            fail(`${name}: climb started ahead of schedule (rail ${step.railYBefore} >= cone ${gcone}+${cfg.HOVER}-${cfg.PLOW_GRACE_UP}) at column ${i}`);
          }
        } else {
          if (-diff < cfg.MIN_CHANGE) fail(`${name}: descent started with diff=${diff} inside MIN_CHANGE=${cfg.MIN_CHANGE} at column ${i}`);
          // Descent starts additionally need clear runway for at least two
          // steps above the descent floor (decide's #dig2 veto).
          if (floorReal && step.railYBefore - 2 < gfloor - cfg.PLOW_GRACE_DOWN) {
            fail(`${name}: descent started without two-step room above the descent floor at column ${i}`);
          }
        }
        inEvent = dir;
        lastDir = dir;
        run = 0; // start_event restarts #evrun; the credit above used the OLD value
      }
      run += 1; // decide counts every sloped column into #evrun
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
    if (drift >= cfg.MIN_CHANGE + 1) fail(`${name}: rail ended ${drift} blocks from target`);
  }
  return discounted;
}

// The mesa's specific promise (the descent guard): once the line has crested
// onto the tabletop it never goes below the tabletop surface again until the
// drop-off at x=320 -- the descent start is vetoed until the whole #DOWNLOOK_AHEAD
// runway is past the edge, so there is no early trench. (The old
// average-chasing behavior started the descent ~45 columns early and
// trenched down through the tabletop to get a head start on the valley
// beyond.) The interior tolerance is #PLOW_GRACE_DOWN (the deliberate
// cut-through allowance); the final 2 columns before the drop-off are
// excluded, because the scan's pair-min spans the rim there and a
// touch-down descent may notch 1 block into the very edge by design.
function checkMesa(ride) {
  const { S, cfg } = ride;
  if (cfg.DOWNLOOK_AHEAD < 1) return;
  const top = 89; // the mesa terrain's tabletop surface
  let crest = -1;
  for (let x = 200; x <= 280; x++) {
    if (S.track[x] >= top + cfg.HOVER) { crest = x; break; }
  }
  if (crest < 0) return fail('mesa: the line never reached cruising height over the tabletop');
  for (let x = crest; x <= 317; x++) {
    if (S.track[x] < top - cfg.PLOW_GRACE_DOWN) {
      return fail(`mesa: the rail dipped into the tabletop (railY ${S.track[x]} < ${top}-${cfg.PLOW_GRACE_DOWN} at x=${x})`);
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
    const index = Math.min(Math.max(Math.floor(px) + cfg.PACE_CART_BEHIND - cfg.RIDER_BEHIND, 0), maxi);
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

  const discounted = checkInvariants(name, java, settles);
  checkCamera(name, java);
  if (name === 'mesa') checkMesa(java);

  // The purpose-built gap-credit terrains must show the credit ENGAGING (an
  // event legally starting inside the full, undiscounted gap) -- otherwise a
  // regression that silently disables the credit (or a config change that
  // starves it) would still pass every structural invariant above.
  if (java.cfg.GAPRATIO >= 1) {
    if (name === 'peak' && discounted.turn < 1) {
      fail('peak: the big-event gap credit never engaged (no reversal started inside the full turn gap)');
    } else if (name === 'peak') {
      ok(`peak: the credit let ${discounted.turn} reversal(s) start inside the full turn gap (descending off the summit early)`);
    }
    if (name === 'bigsteps' && discounted.same < 1) {
      fail('bigsteps: the big-event gap credit never engaged (no same-direction climb started inside the full SAMEGAP)');
    } else if (name === 'bigsteps') {
      ok(`bigsteps: the credit let ${discounted.same} same-direction climb(s) start inside the full SAMEGAP (chaining the big ascent sooner)`);
    }
  }

  // The stretch shift's home case: on peak the verified plan must jump the
  // remaining (credit-discounted) gap at least once, and doing so must NOT
  // split the descent -- the whole ride stays exactly one climb and one
  // descent (no new plateaus, no extra events).
  if (name === 'peak' && java.cfg.SHIFT_REQ_BOTTOM >= 1) {
    if (discounted.shift < 1) {
      fail('peak: the stretch shift never engaged (no descent jumped the gap on a verified landing stretch)');
    } else {
      ok(`peak: the stretch shift let ${discounted.shift} descent(s) jump the gap onto the verified landing stretch`);
    }
    let evCount = 0, inE = 0;
    for (const s of java.log) {
      if (s.dir !== 0 && inE === 0) evCount += 1;
      inE = s.dir;
    }
    if (evCount !== 2) {
      fail(`peak: expected exactly 2 events (one climb, one shifted descent), got ${evCount} -- the shift split or duplicated an event`);
    } else {
      ok('peak: still exactly one climb and one unbroken descent (the shift moved it, never split it)');
    }
  }
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
    const cfg = readCfg(sim);
    sim.set('slope', 0);
    sim.set('flat', 99);
    sim.set('lastDir', 0);
    sim.set('evrun', 0);
    sim.set('vclear', 0);
    sim.set('retro', 0);
    sim.set('SKYMODE', 1);
    sim.set('SKYY', SKYY, 'cfg_ride');
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
