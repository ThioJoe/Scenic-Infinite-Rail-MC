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

  report('modes_init seeded the defaults (torch auto, mobs aggro, speeds, track light)', async (s) => {
    const checks = [];
    if (!(await s.scoreInRange('.TORCHMODE', 'ir', 2))) checks.push('.TORCHMODE != 2 (auto)');
    if (!(await s.scoreInRange('.AGGROMODE', 'ir', 1))) checks.push('.AGGROMODE != 1');
    if (!(await s.scoreInRange('.LIGHTMODE', 'ir', 11))) checks.push('.LIGHTMODE != 11 (bright)');
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

  report('shared speed_step: step / floor / grid-rejoin / reset on Bedrock', async (s) => {
    const base = expected.find((e) => e.holder === '.DEFAULTSPEED')?.value ?? 8;
    await s.fn('speed_inc');
    if (!(await s.scoreInRange('.speed', 'ir', base + 4))) throw new Error(`inc: .speed != ${base + 4}`);
    await s.fn('speed_dec');
    await s.fn('speed_dec');
    await s.fn('speed_dec');
    if (!(await s.scoreInRange('.speed', 'ir', 1))) throw new Error('.speed did not clamp to the floor of 1');
    await s.fn('speed_inc');
    if (!(await s.scoreInRange('.speed', 'ir', 4))) throw new Error('floor + step must rejoin the grid at 4');
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
    await s.fn('speed_reset');
    if (!(await s.scoreInRange('.ocnspd', 'ir', ocean))) throw new Error(`ocean reset: .ocnspd != ${ocean}`);
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
