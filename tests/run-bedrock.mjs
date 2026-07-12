#!/usr/bin/env node
// Bedrock Dedicated Server smoke tests (zero dependencies).
//
//   node tests/run-bedrock.mjs                       # build BP/RP from src/
//   node tests/run-bedrock.mjs --pack Scenic....mcaddon   # test a CI artifact
//   node tests/run-bedrock.mjs --server-dir /path/to/bedrock_server
//
// Boots the headless BDS with the behavior+resource pack under test in a
// fresh world, then drives the console: verifies the pack loads with no
// content-log/script errors, the script's init() applied the shared config,
// and the SHARED BRAIN files (torch_auto, speed_step, modes_init seeding)
// behave identically on the Bedrock command engine.

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { spawnSync } from 'node:child_process';
import { BedrockServer } from './lib/bedrock.mjs';
import { extractZip } from './lib/zip.mjs';

const TESTS_DIR = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.dirname(TESTS_DIR);
const WORK_DIR = path.join(TESTS_DIR, '.work');
fs.mkdirSync(WORK_DIR, { recursive: true });

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

// Locate the test server (provisioned by tests/setup_headless_env.sh).
const serverDirCandidates = [
  opt('--server-dir'),
  process.env.MC_TEST_BEDROCK_DIR,
  process.env.MC_TEST_ENV_DIR && path.join(process.env.MC_TEST_ENV_DIR, 'bedrock_server'),
  process.env.HOME && path.join(process.env.HOME, 'minecraft_test_env', 'bedrock_server'),
  path.resolve(REPO_ROOT, '..', 'minecraft_test_env', 'bedrock_server'),
  '/home/user/minecraft_test_env/bedrock_server',
].filter(Boolean);
const serverDir = serverDirCandidates.find((d) => fs.existsSync(path.join(d, 'bedrock_server')));
if (!serverDir) {
  console.error('No Bedrock test server found. Looked for the bedrock_server binary in:');
  for (const d of serverDirCandidates) console.error(`  - ${d}`);
  console.error('Provision one with tests/setup_headless_env.sh, or pass --server-dir / set MC_TEST_BEDROCK_DIR.');
  process.exit(2);
}

// ---------- resolve BP + RP ----------
function findDirWithManifest(root, suffix) {
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    if (e.isDirectory() && fs.existsSync(path.join(root, e.name, 'manifest.json'))) {
      const man = JSON.parse(fs.readFileSync(path.join(root, e.name, 'manifest.json'), 'utf8'));
      const isBp = man.modules?.some((m) => m.type === 'data' || m.type === 'script');
      if ((suffix === 'BP') === !!isBp) return path.join(root, e.name);
    }
  }
  return null;
}

let bpDir; let rpDir;
const packArg = opt('--pack');
if (!packArg) {
  const build = spawnSync('node', [path.join(REPO_ROOT, 'tools', 'build.mjs')], { cwd: REPO_ROOT, encoding: 'utf8' });
  if (build.status !== 0) { console.error(`build failed:\n${build.stdout}\n${build.stderr}`); process.exit(2); }
  bpDir = path.join(REPO_ROOT, 'dist', 'bedrock', 'Scenic_Infinite_Rail_Mode_BP');
  rpDir = path.join(REPO_ROOT, 'dist', 'bedrock', 'Scenic_Infinite_Rail_Mode_RP');
} else if (fs.statSync(packArg).isDirectory()) {
  bpDir = findDirWithManifest(packArg, 'BP');
  rpDir = findDirWithManifest(packArg, 'RP');
} else {
  const dest = path.join(WORK_DIR, 'bedrock-pack-under-test');
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  extractZip(packArg, dest);
  // A CI artifact zip may wrap the .mcaddon; unwrap nested archives.
  for (let depth = 0; depth < 2 && !findDirWithManifest(dest, 'BP'); depth++) {
    const nested = fs.readdirSync(dest).find((f) => /\.(mcaddon|mcpack|zip)$/i.test(f));
    if (!nested) break;
    const inner = path.join(dest, nested);
    extractZip(inner, dest);
    fs.rmSync(inner);
  }
  bpDir = findDirWithManifest(dest, 'BP');
  rpDir = findDirWithManifest(dest, 'RP');
}
if (!bpDir) { console.error('could not locate the behavior pack (manifest with data/script modules)'); process.exit(2); }
console.log(`BP under test: ${bpDir}`);
console.log(`RP under test: ${rpDir ?? '(none)'}`);

// expected config from the BP's own shared files
const expected = [];
for (const f of ['config.mcfunction', 'consts.mcfunction']) {
  const p = path.join(bpDir, 'functions', 'infinite_rail', f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^scoreboard players set (\.[A-Za-z0-9_]+) ([A-Za-z0-9_]+) (-?\d+)\s*$/);
    if (m) expected.push({ holder: m[1], objective: m[2], value: parseInt(m[3], 10) });
  }
}

// ---------- tests ----------
const results = [];
const report = (name, fn) => ({ name, fn });
const NIGHT_START = 12542; const NIGHT_END = 23459;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The surrogate ride's anchor (see the ride tests at the end of the list):
// a command tickingarea bootstraps the start chunks -- measured on this BDS,
// tickingareas DO load and generate their chunks with zero players online --
// and everything after that is the pack's own chunk scout.
const START_X = 8; const START_Z = 8;
// Only genuine script errors count while the ride runs: the console probes
// themselves (testfor misses, testforblock mismatches) print ERROR lines.
const scriptOnly = (lines) => lines.filter((l) => /\[Scripting\]/i.test(l));
let rideMark = 0;
let groundY = null; // the surrogate's resting level = the start column's surface

const tests = [
  report('BDS boots with the pack, no script/content-log errors', async (s) => {
    const errs = s.scriptErrorsSince(0);
    if (errs.length) throw new Error(`content-log/script errors during boot:\n  ${errs.slice(0, 8).join('\n  ')}`);
  }),

  report('script init applied config.mcfunction to the scoreboard', async (s) => {
    if (!expected.length) throw new Error('no expected config parsed from the BP');
    const wrong = [];
    for (const { holder, objective, value } of expected) {
      if (!(await s.scoreInRange(holder, objective, value))) wrong.push(`${holder} ${objective} != ${value}`);
    }
    if (wrong.length) throw new Error(`config values not applied: ${wrong.join('; ')}`);
  }),

  report('the pack\'s own custom items registered (.itemsok: speed trio + the Toggle HUD pair)', async (s) => {
    // init() probes every bp/items/*.json id with new ItemStack and mirrors
    // the combined answer to .itemsok; a failed probe re-tries every ~30 s,
    // so poll past one retry before declaring the item registry broken.
    const t0 = Date.now();
    while (Date.now() - t0 < 45000) {
      if (await s.scoreInRange('.itemsok', 'ir', 1)) return;
      await sleep(2000);
    }
    throw new Error('.itemsok never reached 1: a bp/items/*.json id did not register on BDS (check the content log)');
  }),

  report('modes_init seeded the defaults (torch auto, mobs aggro, speeds, track light)', async (s) => {
    const checks = [];
    if (!(await s.scoreInRange('.TORCHMODE', 'ir', 2))) checks.push('.TORCHMODE != 2 (auto)');
    if (!(await s.scoreInRange('.LIGHTMODE', 'ir', 11))) checks.push('.LIGHTMODE != 11 (bright)');
    const aggro = expected.find((e) => e.holder === '.MOBAGGRO')?.value;
    if (aggro !== undefined && !(await s.scoreInRange('.AGGROMODE', 'ir', aggro))) checks.push(`.AGGROMODE != ${aggro} (.MOBAGGRO)`);
    const maxspeed = expected.find((e) => e.holder === '.DEFAULTSPEED')?.value;
    if (maxspeed !== undefined && !(await s.scoreInRange('.speed', 'ir', maxspeed))) checks.push(`.speed != ${maxspeed}`);
    const skyspeed = expected.find((e) => e.holder === '.SKYSPEED')?.value;
    if (skyspeed !== undefined && !(await s.scoreInRange('.skyspd', 'ir', skyspeed))) checks.push(`.skyspd != ${skyspeed}`);
    const oceanspeed = expected.find((e) => e.holder === '.OCEANSPEED')?.value;
    if (oceanspeed !== undefined && !(await s.scoreInRange('.ocnspd', 'ir', oceanspeed))) checks.push(`.ocnspd != ${oceanspeed}`);
    const odds = expected.find((e) => e.holder === '.TORCHODDS')?.value;
    if (odds !== undefined && !(await s.scoreInRange('.torchdens', 'ir', odds))) checks.push(`.torchdens != ${odds}`);
    if (checks.length) throw new Error(checks.join('; '));
  }),

  report('shared torch_auto: exact night window on the Bedrock engine', async (s) => {
    const cases = [
      [2, NIGHT_START - 1, 0], [2, NIGHT_START, 1], [2, 18000, 1], [2, NIGHT_END, 1], [2, NIGHT_END + 1, 0],
      [2, 6000, 0], [2, 24000 + 18000, 1], [1, 6000, 1], [0, 18000, 0],
    ];
    for (const [mode, tod, lit] of cases) {
      await s.setScore('.TORCHMODE', 'ir', mode);
      await s.setScore('.tod', 'ir', tod);
      await s.fn('torch_auto');
      if (!(await s.scoreInRange('.torchlit', 'ir', lit))) {
        throw new Error(`mode=${mode} tod=${tod}: expected .torchlit=${lit}`);
      }
    }
    await s.setScore('.TORCHMODE', 'ir', 2);
  }),

  report('shared speed_step: grid walk / floor / reset on Bedrock', async (s) => {
    const base = expected.find((e) => e.holder === '.DEFAULTSPEED')?.value ?? 8; // 8: on the coarse grid
    // Coarse zone (8 up) steps by .SPEEDSTEP (4).
    await s.fn('speed_inc');
    if (!(await s.scoreInRange('.speed', 'ir', base + 4))) throw new Error(`inc: .speed != ${base + 4}`);
    await s.fn('speed_dec');
    if (!(await s.scoreInRange('.speed', 'ir', base))) throw new Error(`dec: .speed != ${base}`);
    // From 8 the fine grid takes over: 8 -> 6 -> 5 -> 4 -> 3 -> 2 -> 1, floor.
    for (const want of [6, 5, 4, 3, 2, 1]) {
      await s.fn('speed_dec');
      if (!(await s.scoreInRange('.speed', 'ir', want))) throw new Error(`dec down the grid: .speed != ${want}`);
    }
    await s.fn('speed_dec');
    if (!(await s.scoreInRange('.speed', 'ir', 1))) throw new Error('.speed did not stay at the floor of 1');
    // Speed + from the floor walks 1 -> 2 -> ... -> 6 -> 8 (skips 7).
    for (const want of [2, 3, 4, 5, 6, 8]) {
      await s.fn('speed_inc');
      if (!(await s.scoreInRange('.speed', 'ir', want))) throw new Error(`inc up the grid: .speed != ${want}`);
    }
    await s.fn('speed_reset');
    if (!(await s.scoreInRange('.speed', 'ir', base))) throw new Error(`reset: .speed != ${base}`);
  }),

  report('shared speed_step: sky mode tunes the sky cruise (.skyspd), land speed untouched', async (s) => {
    const base = expected.find((e) => e.holder === '.DEFAULTSPEED')?.value ?? 8;
    const skyDefault = expected.find((e) => e.holder === '.SKYSPEED')?.value ?? 18;
    await s.setScore('.SKYMODE', 'ir', 1);
    await s.fn('speed_inc');
    if (!(await s.scoreInRange('.skyspd', 'ir', skyDefault + 4))) throw new Error(`sky inc: .skyspd != ${skyDefault + 4}`);
    if (!(await s.scoreInRange('.speed', 'ir', base))) throw new Error('land .speed changed while sky mode owned the ride');
    await s.fn('speed_reset');
    if (!(await s.scoreInRange('.skyspd', 'ir', skyDefault))) throw new Error(`sky reset: .skyspd != ${skyDefault}`);
    await s.setScore('.SKYMODE', 'ir', 0);
  }),

  report('shared speed_step: the ocean sprint tunes the ocean cruise (.ocnspd), both directions', async (s) => {
    const base = expected.find((e) => e.holder === '.DEFAULTSPEED')?.value ?? 8;
    const ocean = expected.find((e) => e.holder === '.OCEANSPEED')?.value ?? 32;
    await s.setScore('.fast', 'ir', 1);
    await s.fn('speed_inc');
    if (!(await s.scoreInRange('.ocnspd', 'ir', ocean + 4))) throw new Error(`ocean inc: .ocnspd != ${ocean + 4}`);
    if (!(await s.scoreInRange('.speed', 'ir', base))) throw new Error('land .speed changed while the sprint owned the ride');
    await s.fn('speed_dec');
    await s.fn('speed_dec');
    if (!(await s.scoreInRange('.ocnspd', 'ir', ocean - 4))) throw new Error('Speed - must go BELOW the ocean default now');
    // The reset is TOTAL: an adjusted land speed must not survive it (that
    // leftover was the "never slowed back down over land" complaint).
    await s.setScore('.speed', 'ir', 40);
    await s.fn('speed_reset');
    if (!(await s.scoreInRange('.ocnspd', 'ir', ocean))) throw new Error(`ocean reset: .ocnspd != ${ocean}`);
    if (!(await s.scoreInRange('.speed', 'ir', base))) throw new Error(`total reset: the land speed must return to ${base} too`);
    await s.setScore('.fast', 'ir', 0);
  }),

  report('mode toggles flip their scores on Bedrock', async (s) => {
    await s.fn('mode_torches_on');
    if (!(await s.scoreInRange('.TORCHMODE', 'ir', 1))) throw new Error('torches on != 1');
    await s.fn('mode_torches_auto');
    if (!(await s.scoreInRange('.TORCHMODE', 'ir', 2))) throw new Error('torches auto != 2');
    await s.fn('torch_density_high');
    if (!(await s.scoreInRange('.torchdens', 'ir', 70))) throw new Error('density high != 70');
    await s.fn('torch_density_medium');
    if (!(await s.scoreInRange('.torchdens', 'ir', 35))) throw new Error('density medium != 35');
    await s.fn('mode_light_low');
    if (!(await s.scoreInRange('.LIGHTMODE', 'ir', 8))) throw new Error('track light low != 8');
    await s.fn('mode_light_off');
    if (!(await s.scoreInRange('.LIGHTMODE', 'ir', 0))) throw new Error('track light off != 0');
    await s.fn('mode_light_on');
    if (!(await s.scoreInRange('.LIGHTMODE', 'ir', 11))) throw new Error('track light on != 11');
  }),

  report('hud toggle: .HUDHIDDEN flips both ways (and the /hud lines parse)', async (s) => {
    // A function file containing a command BDS can't parse is dropped from
    // the registry wholesale, so the score flip doubles as a parse check on
    // the hud_hide/hud_show files' /hud lines (headless, the hud commands
    // themselves just match no targets -- the rest of the file still runs).
    await s.fn('hud_toggle');
    if (!(await s.scoreInRange('.HUDHIDDEN', 'ir', 1))) throw new Error('first toggle: .HUDHIDDEN != 1 (hud_hide missing or unparsed?)');
    await s.fn('hud_toggle');
    if (!(await s.scoreInRange('.HUDHIDDEN', 'ir', 0))) throw new Error('second toggle: .HUDHIDDEN != 0 (hud_show missing or unparsed?)');
  }),

  report('setup_world applies its safety gamerules (phantoms/mobgriefing off) -- the whole file must parse', async (s) => {
    // Same registry rule the hud_toggle test leans on: BDS drops an ENTIRE
    // function if a single line is unparseable. setup_world carries the ride's
    // safety gamerules; a stray device-scoped command in it (a `gametips
    // disable` line once did exactly this -- /gametips has no world form and
    // is only valid run through a player, so it made the whole file vanish and
    // took every gamerule with it: phantoms circling the night ride was the
    // symptom) would silently drop them all. Force the sentinels wrong, run
    // the file, read them back. The boolean is pulled format-agnostically so a
    // change in BDS's gamerule-echo wording can't turn this into a false pass.
    const readBool = async (rule) => {
      const raw = await s.cmd(`gamerule ${rule}`);
      const m = raw.match(/\b(true|false)\b/i);
      return { v: m ? m[1].toLowerCase() : null, raw };
    };
    await s.cmd('gamerule doinsomnia true');
    await s.cmd('gamerule mobgriefing true');
    const ran = await s.fn('setup_world');
    if (/unknown function/i.test(ran)) throw new Error(`setup_world is not in the registry -- a line failed to parse and BDS dropped the whole file: ${ran}`);
    const ins = await readBool('doinsomnia');
    if (ins.v !== 'false') throw new Error(`doinsomnia = ${ins.v} after setup_world (phantoms NOT disabled -- a dropped file drops every safety gamerule). raw: ${JSON.stringify(ins.raw)}`);
    const grf = await readBool('mobgriefing');
    if (grf.v !== 'false') throw new Error(`mobgriefing = ${grf.v} after setup_world (track unprotected). raw: ${JSON.stringify(grf.raw)}`);
  }),

  // --- The surrogate ride: the whole build pipeline, headlessly ------------
  // Java-suite parity (tests/lib/ride.mjs): the ride is started AS a tagged
  // armor stand -- begin() accepts any entity; the player-only comforts
  // no-op -- so placeColumn (carve + surface restoration + support + rail +
  // light), the chunk scout, the virtual pace and the camera rig all run on
  // the real BDS engine with no client attached.

  report('surrogate ride: an armor stand starts a real ride (no player online)', async (s) => {
    await s.cmd(`tickingarea add circle ${START_X} 100 ${START_Z} 4 sirm_test_start`);
    await sleep(8000); // let the start chunks generate
    await s.cmd(`summon armor_stand ${START_X}.5 150 ${START_Z}.5`);
    await s.cmd('tag @e[type=armor_stand] add ir_test_rider');
    const found = await s.cmd('testfor @e[type=armor_stand,tag=ir_test_rider]');
    if (!/Found/i.test(found)) throw new Error(`surrogate did not spawn: ${found}`);
    // Let it land and note the surface level: the start column's rail goes
    // in at surface + .HOVER, which is where the physical probe below looks.
    await sleep(4000);
    const q = await s.cmd('querytarget @e[type=armor_stand,tag=ir_test_rider]');
    const ym = q.match(/"y"\s*:\s*(-?\d+(?:\.\d+)?)/);
    if (ym) groundY = Math.round(parseFloat(ym[1]));
    // The Live-state sidebar mirrors .headX/.started into dbg every tick
    // once the ride runs -- the console's window into the script state.
    await s.fn('sidebar_state');
    rideMark = s.mark();
    await s.cmd('execute as @e[type=armor_stand,tag=ir_test_rider] at @s run scriptevent infinite_rail:start go');
    // begin() polls its start chunks (up to ~50 s) before phase 2 launches.
    const t0 = Date.now();
    while (Date.now() - t0 < 90000) {
      if (await s.scoreInRange('.started', 'dbg', 1)) return;
      await sleep(1000);
    }
    throw new Error('ride never reached .started=1 (begin aborted? check the log)');
  }),

  report('the headless ride keeps building: head advances at pace', async (s) => {
    // The launch pre-build alone reaches ~START_X + camAhead + 32; per-tick
    // building then holds the head .PACE_CART_BEHIND ahead of the rolling
    // pace. Watch the dbg mirror of .headX grow well past the pre-build.
    const t0 = Date.now();
    let h1 = null;
    while (Date.now() - t0 < 60000) {
      h1 = await s.scoreValue('.headX', 'dbg', -1000, 10000);
      if (h1 !== null && h1 >= START_X + 150) break;
      await sleep(2000);
    }
    if (h1 === null || h1 < START_X + 150) throw new Error(`head stuck at ${h1} (wanted >= ${START_X + 150})`);
    await sleep(20000); // the pace rolls 8 blocks/s -> expect ~160 more
    const h2 = await s.scoreValue('.headX', 'dbg', -1000, 20000);
    if (h2 === null || h2 < h1 + 50) throw new Error(`head no longer advancing: ${h1} -> ${h2} in 20 s`);
  }),

  report('the built line is real: rail, support and light stand in the world', async (s) => {
    // Probe the START column: it was placed by the same placeColumn as
    // every other column, its chunk is pinned by the test's own tickingarea
    // (the ride and its scout have long moved east), and its rail sits at
    // surface + .HOVER. The head's CURRENT railY is useless here -- the
    // line may have climbed mountains since -- so the scan window keys off
    // groundY, the surrogate's resting level. Mind that the stand SINKS:
    // on this seed the start is a lake, the stand rests on the lake FLOOR
    // while the rail rides the water SURFACE + .HOVER (liquid surfaces are
    // terrain to the probe), so the window reaches well above groundY.
    if (groundY === null) throw new Error('no groundY from the start test (querytarget failed?)');
    let atY = null;
    for (let y = groundY + 30; y >= groundY - 6; y--) {
      const r = await s.cmd(`testforblock ${START_X} ${y} ${START_Z} golden_rail`, { quietMs: 200 });
      if (/Successfully found/i.test(r)) { atY = y; break; }
    }
    if (atY === null) throw new Error(`no golden_rail at the start column within Y ${groundY - 6}..${groundY + 30}`);
    const sup = await s.cmd(`testforblock ${START_X} ${atY - 1} ${START_Z} infinite_rail:support`);
    if (!/Successfully found/i.test(sup)) throw new Error(`no support block under the rail at Y ${atY - 1}: ${sup}`);
    const light = await s.cmd(`testforblock ${START_X} ${atY + 3} ${START_Z} light_block_11`);
    if (!/Successfully found/i.test(light)) throw new Error(`no track light above the rail at Y ${atY + 3}: ${light}`);
  }),

  // (No command-level item probe on purpose: the pack's own items carry
  // menu_category "none", which hides them from the COMMAND item enum --
  // /replaceitem answers "Syntax error: Unexpected ..." for a perfectly
  // registered id, measured on BDS 1.26.33. The .itemsok test above probes
  // new ItemStack(), the exact path the inventory keeper pins with.)

  report('no script errors during the headless ride', async (s) => {
    const errs = scriptOnly(s.scriptErrorsSince(rideMark));
    if (errs.length) throw new Error(`script errors while riding:\n  ${errs.slice(0, 8).join('\n  ')}`);
  }),

  report('stop tears the surrogate ride down (scout gone, ride ends)', async (s) => {
    await s.fn('stop');
    await sleep(1500);
    const r = await s.cmd('testfor @e[type=infinite_rail:scout]');
    if (!/No targets/i.test(r)) throw new Error(`scout still present after stop: ${r}`);
    await s.cmd('kill @e[type=armor_stand,tag=ir_test_rider]');
    await s.cmd('tickingarea remove sirm_test_start');
  }),
];

// ---------- run ----------
console.log('\n=== Bedrock smoke suite ===');
const server = new BedrockServer({ serverDir, bpDir, rpDir });
let failedCount = 0;
try {
  server.freshWorld();
  process.stdout.write('  booting fresh Bedrock world... ');
  const t0 = Date.now();
  await server.start();
  console.log(`up in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  for (const t of tests) {
    const started = Date.now();
    try {
      await t.fn(server);
      console.log(`  ✔ ${t.name} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
      results.push({ test: t.name, status: 'passed' });
    } catch (err) {
      failedCount++;
      console.log(`  ✘ ${t.name}\n      ${String(err.message).split('\n').join('\n      ')}`);
      results.push({ test: t.name, status: 'failed', detail: String(err.message) });
    }
  }
} catch (err) {
  failedCount++;
  console.error(`SUITE ABORTED: ${err.message}`);
  results.push({ test: '(boot)', status: 'failed', detail: String(err.message) });
} finally {
  await server.stop().catch(() => {});
}

console.log(`\nRESULT: ${results.filter((r) => r.status === 'passed').length} passed, ${failedCount} failed`);
fs.writeFileSync(path.join(WORK_DIR, 'results-bedrock.json'), JSON.stringify({ results }, null, 2));
process.exit(failedCount ? 1 : 0);
