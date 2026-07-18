#!/usr/bin/env node
// =============================================================================
//  Infinite Rail monorepo build
//
//  Assembles the two release packs from the split source tree:
//
//    src/shared/functions/*.mcfunction  -> injected into BOTH packs verbatim
//    src/java/** -> Java Edition data pack
//    src/bedrock/** -> Bedrock Edition behavior pack
//
//  Outputs (all under dist/). The .zip / .mcaddon names carry the version and,
//  in CI (GITHUB_RUN_NUMBER set), a -<run_number> suffix: <pack>_<version>[-N].
//    dist/java/Scenic_Infinite_Rail_Mode/           ready-to-drop datapack folder
//    dist/ScenicInfiniteRailMode-Java_<version>.zip  drag-and-drop datapack zip
//    dist/bedrock/Scenic_Infinite_Rail_Mode_BP/     behavior pack folder
//    dist/bedrock/Scenic_Infinite_Rail_Mode_RP/     resource pack folder (the
//                                                   invisible seat entity)
//    dist/ScenicInfiniteRailMode-Bedrock_<version>.mcaddon  double-click-to-
//                                                   import (BP+RP; the BP
//                                                   manifest depends on the RP,
//                                                   so activating one pulls both)
//
//  Zero dependencies: the .zip/.mcpack writer below uses only node:zlib.
//  Usage: node tools/build.mjs [--check]   (--check = lint/validate only)
// =============================================================================

import { deflateRawSync } from 'node:zlib';
import {
  cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync,
  statSync, writeFileSync,
} from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectRefs, findMismatches } from './check-version.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_SHARED = join(ROOT, 'src', 'shared', 'functions');
const SRC_JAVA = join(ROOT, 'src', 'java');
const SRC_BEDROCK_BP = join(ROOT, 'src', 'bedrock', 'bp');
const SRC_BEDROCK_RP = join(ROOT, 'src', 'bedrock', 'rp');
const DIST = join(ROOT, 'dist');
const CHECK_ONLY = process.argv.includes('--check');

/** @param {string} msg */
const fail = (msg) => { console.error(`BUILD FAILED: ${msg}`); process.exit(1); };

// ---------------------------------------------------------------------------
// Version: single source of truth is the Bedrock BP manifest header version.
// Every product-version reference in both manifests (module versions, the
// BP->RP dependency, the RP header) must match it. The same check runs as its
// own CI step (tools/check-version.mjs --consistency); reusing it here keeps a
// local `node tools/build.mjs` honest too.
// ---------------------------------------------------------------------------
const versionInfo = collectRefs(ROOT);
const VERSION = versionInfo.sot;
const mismatches = findMismatches(versionInfo);
if (mismatches.length || versionInfo.uuidMismatch) {
  for (const r of mismatches) {
    console.error(`  ${r.label} is ${r.version}, expected ${VERSION} (${r.file})`);
  }
  if (versionInfo.uuidMismatch) {
    console.error('  BP->RP dependency uuid does not match the RP header uuid');
  }
  fail(`version references disagree with the source of truth ${VERSION} (${versionInfo.sotFile})`);
}

// ---------------------------------------------------------------------------
// 1. Lint the shared functions against the dual-dialect subset.
//
// A shared file may only contain commands that parse identically on Java and
// Bedrock: comments, scoreboard set/add/remove/operation on fake players, and
// execute if/unless score ... run <scoreboard|function|execute>.
// ---------------------------------------------------------------------------
const FORBIDDEN_ANYWHERE = [
  ['$(', 'function macros are Java-only'],
  ['storage', 'command storage is Java-only'],
  ['@', 'selectors are not dialect-safe (positioning/NBT rules differ)'],
  ['~', 'coordinates imply engine-specific positioning'],
  ['#', 'score holders must use . prefix on both editions'],
  [':', 'namespace colons are forbidden in shared calls'],
  ['/', 'folder slashes are forbidden in shared calls']
];

/**
 * @param {string} file
 * @param {number} lineNo
 * @param {string} raw
 * @param {string[]} errors
 */
function lintSharedLine(file, lineNo, raw, errors) {
  const line = raw.trim();
  if (line === '' || line.startsWith('#')) return;
  // The "/" token exists to catch folder-slash function calls, but the
  // scoreboard divide operator (" /= ") is a legitimate dual-dialect
  // operation on both engines -- mask it out before the forbidden scan.
  const scannable = line.replace(/ \/= /g, ' ');
  let forbidden = false;
  for (const [tok, why] of FORBIDDEN_ANYWHERE) {
    if (scannable.includes(tok)) {
      errors.push(`${file}:${lineNo}: contains "${tok}" (${why})`);
      forbidden = true;
    }
  }
  if (forbidden) return; // checkCommand would just misparse the same bad line
  checkCommand(file, lineNo, line, errors);
}

/**
 * @param {string} file
 * @param {number} lineNo
 * @param {string} cmd
 * @param {string[]} errors
 */
function checkCommand(file, lineNo, cmd, errors) {
  const head = cmd.split(/\s+/, 1)[0];
  if (head === 'scoreboard') {
    if (!/^scoreboard players (set|add|remove|operation|reset) /.test(cmd)) {
      errors.push(`${file}:${lineNo}: only scoreboard players set/add/remove/operation/reset are dual-dialect`);
    }
    return;
  }
  if (head === 'function') {
    if (!/^function ir_[a-z0-9_]+$/.test(cmd)) {
      errors.push(`${file}:${lineNo}: shared function calls must be bare "function ir_<name>" trampolines`);
    }
    return;
  }
  if (head === 'execute') {
    if (/\bstore\b/.test(cmd)) errors.push(`${file}:${lineNo}: "execute store" is Java-only`);
    // The comparator set is exactly the five both engines accept ('==' is
    // valid on neither, so it must not slip through as [<>=]=? once did).
    const m = cmd.match(/^execute ((?:(?:if|unless) score \S+ \S+ (?:matches \S+|(?:<=|>=|=|<|>) \S+ \S+) )+)run (.+)$/);
    if (!m) {
      errors.push(`${file}:${lineNo}: shared execute lines must be only if/unless-score conditions + run`);
      return;
    }
    checkCommand(file, lineNo, m[2], errors);
    return;
  }
  errors.push(`${file}:${lineNo}: command "${head}" is not in the shared dual-dialect subset`);
}

if (!existsSync(SRC_SHARED)) fail(`missing ${SRC_SHARED}`);
const sharedFiles = readdirSync(SRC_SHARED).filter((/** @type {string} */ f) => f.endsWith('.mcfunction')).sort();
if (sharedFiles.length === 0) fail('no shared functions found');
const shared = new Map(); // name -> content
/** @type {string[]} */
const lintErrors = [];
for (const f of sharedFiles) {
  const content = readFileSync(join(SRC_SHARED, f), 'utf8');
  content.split('\n').forEach((/** @type {string} */ l, /** @type {number} */ i) => lintSharedLine(`src/shared/functions/${f}`, i + 1, l, lintErrors));
  shared.set(f, content);
}
if (lintErrors.length > 0) {
  for (const msg of lintErrors) console.error(`  ${msg}`);
  fail(`${lintErrors.length} shared dialect lint error${lintErrors.length === 1 ? '' : 's'} (see above)`);
}

// A shared file must never silently shadow an edition-specific one.
const shadowErrors = [];
for (const f of sharedFiles) {
  if (existsSync(join(SRC_JAVA, 'data', 'infinite_rail', 'function', f))) {
    shadowErrors.push(`${f} exists in both src/shared and src/java`);
  }
  if (existsSync(join(SRC_BEDROCK_BP, 'functions', 'infinite_rail', f))) {
    shadowErrors.push(`${f} exists in both src/shared and src/bedrock/bp`);
  }
}
if (shadowErrors.length > 0) {
  for (const msg of shadowErrors) console.error(`  ${msg}`);
  fail(`${shadowErrors.length} shared/edition function name collision${shadowErrors.length === 1 ? '' : 's'} (see above)`);
}

// ---------------------------------------------------------------------------
// 1b. The Bedrock script's CONFIG_DEFAULTS mirror of config.mcfunction.
//
// cfg() in scripts/main.js needs a literal fallback for every knob: on
// cmd-bridge worlds (split scoreboards) the Script API cannot read the
// scores the command-run config wrote, and on a half-installed pack the
// config function cannot run at all. config.mcfunction stays the single
// source of truth -- this check fails the build whenever the mirror (or
// CFG_GROUPS' objective placement) drifts from it, because hand-sync does
// not hold (.BUILD_FACTOR and .MIN_CHANGE both drifted that way).
// ---------------------------------------------------------------------------
{
  const knobs = new Map(); // NAME -> { objective, value }
  for (const line of shared.get('config.mcfunction').split('\n')) {
    const m = line.match(/^scoreboard players set \.([A-Za-z0-9_]+) ([A-Za-z0-9_]+) (-?\d+)\s*$/);
    if (m) knobs.set(m[1], { objective: m[2], value: parseInt(m[3], 10) });
  }
  if (knobs.size < 25) fail(`config.mcfunction: only ${knobs.size} knobs parsed -- format changed?`);

  const script = readFileSync(join(SRC_BEDROCK_BP, 'scripts', 'main.js'), 'utf8');
  const defSrc = script.match(/const CONFIG_DEFAULTS = \{([\s\S]*?)\n\};/);
  if (!defSrc) fail('scripts/main.js: CONFIG_DEFAULTS block not found');
  const defaults = new Map(
    [...defSrc[1].matchAll(/([A-Za-z0-9_]+):\s*(-?\d+)/g)].map((m) => [m[1], parseInt(m[2], 10)]));

  const groupSrc = script.match(/const CFG_GROUPS = \{([\s\S]*?)\n\};/);
  if (!groupSrc) fail('scripts/main.js: CFG_GROUPS block not found');
  const groupOf = new Map(); // NAME -> cfg_* objective (the script's default is ir)
  for (const g of groupSrc[1].matchAll(/(cfg_[a-z]+):\s*\[([\s\S]*?)\]/g)) {
    for (const k of g[2].matchAll(/'([A-Za-z0-9_]+)'/g)) groupOf.set(k[1], g[1]);
  }

  const mirrorErrors = [];
  for (const [name, { objective, value }] of knobs) {
    if (!defaults.has(name)) {
      mirrorErrors.push(`scripts/main.js CONFIG_DEFAULTS is missing ${name} (config.mcfunction sets .${name} ${objective} ${value})`);
      continue;
    }
    if (defaults.get(name) !== value) {
      mirrorErrors.push(`scripts/main.js CONFIG_DEFAULTS.${name} is ${defaults.get(name)}, but config.mcfunction sets ${value} -- update the mirror`);
    }
    const reads = groupOf.get(name) ?? 'ir';
    if (reads !== objective) {
      mirrorErrors.push(`.${name}: config.mcfunction writes it into ${objective}, but the script reads it from ${reads} (CFG_GROUPS)`);
    }
  }
  for (const name of defaults.keys()) {
    if (!knobs.has(name)) {
      mirrorErrors.push(`scripts/main.js CONFIG_DEFAULTS has ${name}, which config.mcfunction never sets -- remove it or add the knob`);
    }
  }

  // Print all the accumulated mirror errors at once, so the user can fix them all.
  if (mirrorErrors.length > 0) {
    for (const msg of mirrorErrors) console.error(`  ${msg}`);
    fail(`${mirrorErrors.length} config mirror mismatch${mirrorErrors.length === 1 ? '' : 'es'} between config.mcfunction and scripts/main.js (see above)`);
  }
}

// ---------------------------------------------------------------------------
// 2. Assemble the output trees.
// ---------------------------------------------------------------------------
const JAVA_OUT = join(DIST, 'java', 'Scenic_Infinite_Rail_Mode');
const BEDROCK_OUT = join(DIST, 'bedrock', 'Scenic_Infinite_Rail_Mode_BP');
const BEDROCK_RP_OUT = join(DIST, 'bedrock', 'Scenic_Infinite_Rail_Mode_RP');

if (!CHECK_ONLY) {
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });

  // Java: copy the edition tree, then drop the shared functions in verbatim.
  cpSync(SRC_JAVA, JAVA_OUT, { recursive: true });
  for (const [f, content] of shared) {
    writeFileSync(join(JAVA_OUT, 'data', 'infinite_rail', 'function', f), content);
  }

  // Bedrock: copy the edition tree, then drop the shared functions in verbatim.
  cpSync(SRC_BEDROCK_BP, BEDROCK_OUT, { recursive: true });
  cpSync(SRC_BEDROCK_RP, BEDROCK_RP_OUT, { recursive: true });
  mkdirSync(join(BEDROCK_OUT, 'functions', 'infinite_rail'), { recursive: true });
  for (const [f, content] of shared) {
    writeFileSync(join(BEDROCK_OUT, 'functions', 'infinite_rail', f), content);
  }
}

// ---------------------------------------------------------------------------
// 3. Validate the assembled packs. (--check mode exits above, after the
//    shared-dialect lint only -- it never reaches this.)
// ---------------------------------------------------------------------------
/**
 * @param {string} dir
 * @returns {Generator<string>}
 */
function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

/**
 * @param {string} path
 * @param {string[]} errors
 */
function validateJson(path, errors) {
  try { JSON.parse(readFileSync(path, 'utf8')); }
  catch (/** @type {any} */ e) { errors.push(`invalid JSON in ${path}: ${e.message}`); }
}

/**
 * @param {string} root
 * @param {string} edition
 */
function validatePack(root, edition) {
  // Every function reference must resolve to a file in this pack.
  const fnDir = edition === 'java'
    ? join(root, 'data', 'infinite_rail', 'function')
    : join(root, 'functions');
  const overlayFnDir = join(root, 'overlay_snake', 'data', 'infinite_rail', 'function');
  
  /** @param {string} name */
  const existsFn = (name) => {
    if (edition === 'java') {
      // Resolve Java bridge trampolines
      if (name.startsWith('ir_')) {
        return existsSync(join(root, 'data', 'minecraft', 'function', `${name}.mcfunction`));
      }
      const path = name.replace('infinite_rail:', '');
      return existsSync(join(fnDir, `${path}.mcfunction`)) ||
             existsSync(join(overlayFnDir, `${path}.mcfunction`));
    }
    // Resolves both infinite_rail/foo and ir_foo for Bedrock
    return existsSync(join(fnDir, ...`${name}.mcfunction`.split('/')));
  };

  const refRe = edition === 'java'
    ? /(?:^|run )function (infinite_rail:[a-z0-9_]+|ir_[a-z0-9_]+)/gm
    : /(?:^|run )function ([a-z0-9_/]+)/gm;

  const errors = [];
  for (const file of walk(root)) {
    if (file.endsWith('.json') || file.endsWith('.mcmeta')) validateJson(file, errors);
    // Function references inside tag files (Java's load/tick hooks, Bedrock's
    // tick.json) must resolve too -- a typo there breaks the pack silently.
    const norm = file.split(sep).join('/');
    if (norm.endsWith('.json') && (norm.includes('/tags/function/') || norm.endsWith('functions/tick.json'))) {
      let tag;
      try { tag = JSON.parse(readFileSync(file, 'utf8')); }
      catch { tag = null; } // already reported above as invalid JSON
      for (const v of tag?.values ?? []) {
        if (!existsFn(v)) {
          errors.push(`${relative(ROOT, file)}: tag references missing function "${v}"`);
        }
      }
    }
    if (!file.endsWith('.mcfunction')) continue;
    const text = readFileSync(file, 'utf8');
    for (const line of text.split('\n')) {
      if (line.trim().startsWith('#')) continue;
      for (const m of line.matchAll(refRe)) {
        if (!existsFn(m[1])) {
          errors.push(`${relative(ROOT, file)}: references missing function "${m[1]}"`);
        }
      }
    }
  }

  if (errors.length > 0) {
    for (const msg of errors) console.error(`  ${msg}`);
    fail(`${errors.length} validation error${errors.length === 1 ? '' : 's'} in the ${edition} pack (see above)`);
  }
}

if (CHECK_ONLY) {
  // --check is the quick source lint only; pack assembly, JSON validation and
  // function-reference resolution happen in a full (default) build.
  console.log(`shared dialect lint OK (${sharedFiles.length} shared functions); run without --check for full validation`);
  process.exit(0);
}

validatePack(JAVA_OUT, 'java');
validatePack(BEDROCK_OUT, 'bedrock');

/** @type {string[]} */
const rpJsonErrors = []; // Accumulator for Bedrock RP JSON errors.
for (const file of walk(BEDROCK_RP_OUT)) {
  if (file.endsWith('.json')) validateJson(file, rpJsonErrors);
}
if (rpJsonErrors.length > 0) { // Print all at once
  for (const msg of rpJsonErrors) console.error(`  ${msg}`);
  fail(`${rpJsonErrors.length} invalid JSON file${rpJsonErrors.length === 1 ? '' : 's'} in the Bedrock RP (see above)`);
}

// Accumulator for missing-file errors.
const missingFiles = [];
// Sanity: the packs' entry metadata files must exist at their roots -- and so
// must each edition's vegetation list (now maintained by hand per edition:
// Java's keep.json block tag, Bedrock's vegetation.js module). A missing tag
// would silently no-op Java's carve checks at runtime, so fail here instead.
if (!existsSync(join(JAVA_OUT, 'pack.mcmeta'))) missingFiles.push('Java pack has no pack.mcmeta');
if (!existsSync(join(JAVA_OUT, 'data', 'infinite_rail', 'tags', 'block', 'keep.json'))) missingFiles.push('Java pack has no tags/block/keep.json (the carve\'s vegetation list)');
if (!existsSync(join(JAVA_OUT, 'data', 'infinite_rail', 'tags', 'block', 'not_terrain.json'))) missingFiles.push('Java pack has no tags/block/not_terrain.json (the surface probe\'s dig-down list)');
if (!existsSync(join(BEDROCK_OUT, 'manifest.json'))) missingFiles.push('Bedrock BP has no manifest.json');
if (!existsSync(join(BEDROCK_OUT, 'scripts', 'main.js'))) missingFiles.push('Bedrock BP has no scripts/main.js');
if (!existsSync(join(BEDROCK_OUT, 'scripts', 'vegetation.js'))) missingFiles.push('Bedrock BP has no scripts/vegetation.js (the carve\'s vegetation list)');
if (!existsSync(join(BEDROCK_OUT, 'scripts', 'not_terrain.js'))) missingFiles.push('Bedrock BP has no scripts/not_terrain.js (the surface probe\'s dig-down list)');
if (!existsSync(join(BEDROCK_RP_OUT, 'manifest.json'))) missingFiles.push('Bedrock RP has no manifest.json');

// The pack icons ship right next to the metadata that names them: pack.png by
// pack.mcmeta on Java, pack_icon.png by each manifest.json on Bedrock. The
// recursive cpSync above places them automatically -- guard them here so a
// deleted/renamed source icon fails the build instead of shipping iconless.
if (!existsSync(join(JAVA_OUT, 'pack.png'))) missingFiles.push('Java pack has no pack.png (the pack icon)');
if (!existsSync(join(BEDROCK_OUT, 'pack_icon.png'))) missingFiles.push('Bedrock BP has no pack_icon.png (the pack icon)');
if (!existsSync(join(BEDROCK_RP_OUT, 'pack_icon.png'))) missingFiles.push('Bedrock RP has no pack_icon.png (the pack icon)');

// Print all the accumulated missing-file errors at once, so the user can fix them all.
if (missingFiles.length > 0) {
  for (const msg of missingFiles) console.error(`  ${msg}`);
  fail(`${missingFiles.length} missing required file${missingFiles.length === 1 ? '' : 's'} in the assembled packs (see above)`);
}

// ---------------------------------------------------------------------------
// 4. Zip writer (store + deflate, fixed timestamps for reproducible output).
// ---------------------------------------------------------------------------
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
/** @param {Uint8Array} buf */
const crc32 = (buf) => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

/**
 * @param {string} srcDir
 * @param {string} outFile
 */
function zipDirectory(srcDir, outFile) {
  // DOS date/time fixed at 2026-01-01 00:00:00 so rebuilds are byte-identical.
  const dosTime = 0, dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
  const files = [...walk(srcDir)].sort();
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(relative(srcDir, file).split(sep).join('/'), 'utf8');
    const data = readFileSync(file);
    const crc = crc32(data);
    const deflated = deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const payload = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);            // version needed
    local.writeUInt16LE(0, 6);             // flags
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);            // extra length
    chunks.push(local, name, payload);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);               // version made by
    cd.writeUInt16LE(20, 6);               // version needed
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(dosTime, 12);
    cd.writeUInt16LE(dosDate, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(payload.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt32LE(0, 30);               // extra+comment lengths
    cd.writeUInt32LE(0, 34);               // disk# + internal attrs
    cd.writeUInt32LE(0, 38);               // external attrs
    cd.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([cd, name]));
    offset += local.length + name.length + payload.length;
  }

  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cdBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  writeFileSync(outFile, Buffer.concat([...chunks, cdBuf, end]));
}

// Output names are <pack>_<version>, with -<run_number> appended in CI (where
// GITHUB_RUN_NUMBER is set) to match the uploaded artifact names -- so a
// release attachment (<pack>_<version>) is the file with the -<run_number>
// chopped off. Locally (no run number) the name is just <pack>_<version>.
const runNumber = (process.env.GITHUB_RUN_NUMBER ?? '').trim();
const stamp = runNumber ? `${VERSION}-${runNumber}` : VERSION;
const javaZip = join(DIST, `ScenicInfiniteRailMode-Java_${stamp}.zip`);
const bedrockAddon = join(DIST, `ScenicInfiniteRailMode-Bedrock_${stamp}.mcaddon`);
zipDirectory(JAVA_OUT, javaZip);                    // pack.mcmeta at zip root
zipDirectory(join(DIST, 'bedrock'), bedrockAddon);  // BP + RP folders at zip root

/** @param {string} d */
const count = (d) => [...walk(d)].length;
console.log(`Scenic Infinite Rail Mode v${VERSION}`);
console.log(`  shared functions injected: ${sharedFiles.length} (${sharedFiles.map((/** @type {string} */ f) => f.replace('.mcfunction', '')).join(', ')})`);
console.log(`  Java pack:    ${relative(ROOT, JAVA_OUT)} (${count(JAVA_OUT)} files) -> ${relative(ROOT, javaZip)} (${statSync(javaZip).size} bytes)`);
console.log(`  Bedrock BP+RP: ${relative(ROOT, join(DIST, 'bedrock'))} (${count(join(DIST, 'bedrock'))} files) -> ${relative(ROOT, bedrockAddon)} (${statSync(bedrockAddon).size} bytes)`);
