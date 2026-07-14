#!/usr/bin/env node
// Scenic Infinite Rail Mode -- integration test runner (zero dependencies).
//
//   node tests/run.mjs                        # build pack from src/ and test it
//   node tests/run.mjs --pack dist/Scenic....zip   # test a built artifact zip
//   node tests/run.mjs --pack path/to/Scenic_Infinite_Rail_Mode  # a pack folder
//   node tests/run.mjs --filter torch         # only suites/tests matching
//   node tests/run.mjs --smoke                # boot suite only (does the pack load?)
//   node tests/run.mjs --list                 # list suites/tests, run nothing
//
// Each suite boots the headless test server with a brand-new world (fixed
// seed) and the pack under test deployed, runs its tests in order over
// RCON, then shuts the server down. See tests/README.md.

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { JavaServer } from './lib/server.mjs';
import { MC } from './lib/mc.mjs';
import { resolvePack, parseExpectedConfig } from './lib/pack.mjs';
import { runSuite } from './lib/harness.mjs';

const TESTS_DIR = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.dirname(TESTS_DIR);
const WORK_DIR = path.join(TESTS_DIR, '.work');

// ---------- args ----------
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (name) => args.includes(name);

if (has('--help') || has('-h')) {
  console.log(fs.readFileSync(url.fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 12).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(0);
}

// Locate the test server (provisioned by tests/setup_headless_env.sh).
const serverDirCandidates = [
  opt('--server-dir'),
  process.env.MC_TEST_SERVER_DIR,
  process.env.MC_TEST_ENV_DIR && path.join(process.env.MC_TEST_ENV_DIR, 'java_server'),
  process.env.HOME && path.join(process.env.HOME, 'minecraft_test_env', 'java_server'),
  path.resolve(REPO_ROOT, '..', 'minecraft_test_env', 'java_server'),
  '/home/user/minecraft_test_env/java_server',
].filter(Boolean);
const serverDir = serverDirCandidates.find((d) => fs.existsSync(path.join(d, 'server.jar')));
const filter = opt('--filter')?.toLowerCase();
const jsonOut = opt('--json');
// --smoke: the "does the server still load & initialize the pack" tier -- runs
// only the boot suite (00-boot). Used by CI for metadata-only commits, where a
// full ride suite can't tell you anything a boot check can't.
const smoke = has('--smoke');

if (!serverDir) {
  console.error('No Java test server found. Looked for server.jar in:');
  for (const d of serverDirCandidates) console.error(`  - ${d}`);
  console.error('Provision one with tests/setup_headless_env.sh, or pass --server-dir / set MC_TEST_SERVER_DIR.');
  process.exit(2);
}

fs.mkdirSync(WORK_DIR, { recursive: true });

// ---------- suites ----------
const suiteFiles = fs.readdirSync(path.join(TESTS_DIR, 'suites'))
  .filter((f) => f.endsWith('.test.mjs'))
  .sort();
const suites = [];
for (const f of suiteFiles) {
  const mod = await import(url.pathToFileURL(path.join(TESTS_DIR, 'suites', f)).href);
  if (!mod.default?.tests) {
    console.error(`suite ${f} has no default defineSuite() export`);
    process.exit(2);
  }
  suites.push({ file: f, ...mod.default });
}

if (has('--list')) {
  for (const s of suites) {
    console.log(`${s.file}  --  ${s.name}`);
    for (const t of s.tests) console.log(`    - ${t.name}`);
  }
  process.exit(0);
}

// ---------- pack under test ----------
const packDir = resolvePack(opt('--pack'), { repoRoot: REPO_ROOT, workDir: WORK_DIR });
const expected = parseExpectedConfig(packDir);
console.log(`Pack under test: ${packDir}`);
console.log(`Server:          ${serverDir}`);

// ---------- run ----------
const allResults = [];
const t0 = Date.now();

for (const suite of suites) {
  if (smoke && !/^00-/.test(suite.file)) continue;
  if (filter
    && !suite.name.toLowerCase().includes(filter)
    && !suite.tests.some((t) => t.name.toLowerCase().includes(filter))) {
    continue;
  }
  console.log(`\n=== ${suite.name} (${suite.file}) ===`);
  const server = new JavaServer({ serverDir, packDir, ...(suite.opts.server ?? {}) });
  let ctx;
  try {
    server.freshWorld();
    process.stdout.write('  booting fresh world... ');
    const bt = Date.now();
    await server.start();
    console.log(`up in ${((Date.now() - bt) / 1000).toFixed(1)}s`);
    ctx = { mc: new MC(server.rcon), server, packDir, expected, state: {} };
  } catch (err) {
    console.error(`  SUITE ABORTED: ${err.message}`);
    allResults.push({ suite: suite.name, test: '(boot)', status: 'failed', ms: 0, detail: String(err.message), notes: [] });
    await server.stop().catch(() => {});
    continue;
  }

  const results = await runSuite(suite, ctx, {
    filter,
    onResult: (r) => {
      const icon = r.status === 'passed' ? '  ✔' : r.status === 'skipped' ? '  ~' : '  ✘';
      console.log(`${icon} ${r.test} (${(r.ms / 1000).toFixed(1)}s)${r.status === 'skipped' ? `  [skip: ${r.detail}]` : ''}`);
      if (r.status === 'failed') console.log(`      ${r.detail.split('\n').join('\n      ')}`);
      for (const n of r.notes) console.log(`      note: ${n}`);
    },
  });
  allResults.push(...results);
  await server.stop().catch(() => {});
}

// ---------- report ----------
const passed = allResults.filter((r) => r.status === 'passed').length;
const failed = allResults.filter((r) => r.status === 'failed');
const skipped = allResults.filter((r) => r.status === 'skipped').length;

console.log(`\n${'='.repeat(64)}`);
console.log(`RESULT: ${passed} passed, ${failed.length} failed, ${skipped} skipped  (${((Date.now() - t0) / 1000 / 60).toFixed(1)} min)`);
if (failed.length) {
  console.log('\nFailures:');
  for (const f of failed) console.log(`  ✘ [${f.suite}] ${f.test}\n      ${f.detail.split('\n')[0]}`);
}

const report = { when: null, pack: packDir, passed, failed: failed.length, skipped, results: allResults };
fs.writeFileSync(jsonOut ?? path.join(WORK_DIR, 'results.json'), JSON.stringify(report, null, 2));

process.exit(failed.length ? 1 : 0);
