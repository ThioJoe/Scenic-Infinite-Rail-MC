#!/usr/bin/env node
// =============================================================================
//  Infinite Rail monorepo build
//
//  Assembles the two release packs from the split source tree:
//
//    src/shared/functions/*.mcfunction  -> injected into BOTH packs
//    src/java/**                        -> Java Edition data pack
//    src/bedrock/**                     -> Bedrock Edition behavior pack
//
//  Outputs (all under dist/):
//    dist/java/infinite_rail/                     ready-to-drop datapack folder
//    dist/InfiniteRail-Java-v<version>.zip        drag-and-drop datapack zip
//    dist/bedrock/InfiniteRail_BP/                behavior pack folder
//    dist/InfiniteRail-Bedrock-v<version>.mcpack  double-click-to-import pack
//
//  Shared .mcfunction files must parse on BOTH engines, so this script:
//    1. lints them against a strict dual-dialect subset (scoreboard math,
//       execute-if-score, and function calls only), and
//    2. rewrites Java function references ("function infinite_rail:name") to
//       Bedrock path syntax ("function infinite_rail/name") for the Bedrock
//       copy. That one mechanical rename is the entire per-edition delta.
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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_SHARED = join(ROOT, 'src', 'shared', 'functions');
const SRC_JAVA = join(ROOT, 'src', 'java');
const SRC_BEDROCK = join(ROOT, 'src', 'bedrock');
const DIST = join(ROOT, 'dist');
const CHECK_ONLY = process.argv.includes('--check');

const fail = (msg) => { console.error(`BUILD FAILED: ${msg}`); process.exit(1); };

// ---------------------------------------------------------------------------
// Version: single source of truth is the Bedrock manifest header version.
// ---------------------------------------------------------------------------
const manifest = JSON.parse(readFileSync(join(SRC_BEDROCK, 'manifest.json'), 'utf8'));
const VERSION = manifest.header.version.join('.');

// ---------------------------------------------------------------------------
// 1. Lint the shared functions against the dual-dialect subset.
//
// A shared file may only contain commands that parse identically on Java and
// Bedrock: comments, scoreboard set/add/remove/operation on fake players, and
// execute if/unless score ... run <scoreboard|function|execute>. Anything
// engine-specific (NBT/data/storage, macros, selectors, selectors-with-NBT,
// coordinates, block/entity commands) must live in src/java or src/bedrock.
// ---------------------------------------------------------------------------
const FORBIDDEN_ANYWHERE = [
  ['$(', 'function macros are Java-only'],
  ['storage', 'command storage is Java-only'],
  ['@', 'selectors are not dialect-safe (positioning/NBT rules differ)'],
  ['~', 'coordinates imply engine-specific positioning'],
];

function lintSharedLine(file, lineNo, raw) {
  const line = raw.trim();
  if (line === '' || line.startsWith('#')) return;
  for (const [tok, why] of FORBIDDEN_ANYWHERE) {
    if (line.includes(tok)) fail(`${file}:${lineNo}: contains "${tok}" (${why})`);
  }
  checkCommand(file, lineNo, line);
}

function checkCommand(file, lineNo, cmd) {
  const head = cmd.split(/\s+/, 1)[0];
  if (head === 'scoreboard') {
    if (!/^scoreboard players (set|add|remove|operation|reset) /.test(cmd)) {
      fail(`${file}:${lineNo}: only scoreboard players set/add/remove/operation/reset are dual-dialect`);
    }
    return;
  }
  if (head === 'function') {
    if (!/^function infinite_rail:[a-z0-9_]+$/.test(cmd)) {
      fail(`${file}:${lineNo}: shared function calls must be plain "function infinite_rail:<name>" (no macro args)`);
    }
    return;
  }
  if (head === 'execute') {
    if (/\bstore\b/.test(cmd)) fail(`${file}:${lineNo}: "execute store" is Java-only`);
    const m = cmd.match(/^execute ((?:(?:if|unless) score \S+ \S+ (?:matches \S+|[<>=]=? \S+ \S+|[<>] \S+ \S+) )+)run (.+)$/);
    if (!m) fail(`${file}:${lineNo}: shared execute lines must be only if/unless-score conditions + run`);
    checkCommand(file, lineNo, m[2]);
    return;
  }
  fail(`${file}:${lineNo}: command "${head}" is not in the shared dual-dialect subset`);
}

if (!existsSync(SRC_SHARED)) fail(`missing ${SRC_SHARED}`);
const sharedFiles = readdirSync(SRC_SHARED).filter((f) => f.endsWith('.mcfunction')).sort();
if (sharedFiles.length === 0) fail('no shared functions found');
const shared = new Map(); // name -> content
for (const f of sharedFiles) {
  const content = readFileSync(join(SRC_SHARED, f), 'utf8');
  content.split('\n').forEach((l, i) => lintSharedLine(`src/shared/functions/${f}`, i + 1, l));
  shared.set(f, content);
}

// A shared file must never silently shadow an edition-specific one.
for (const f of sharedFiles) {
  if (existsSync(join(SRC_JAVA, 'data', 'infinite_rail', 'function', f))) {
    fail(`${f} exists in both src/shared and src/java`);
  }
  if (existsSync(join(SRC_BEDROCK, 'functions', 'infinite_rail', f))) {
    fail(`${f} exists in both src/shared and src/bedrock`);
  }
}

// ---------------------------------------------------------------------------
// 2. Assemble the output trees.
// ---------------------------------------------------------------------------
const JAVA_OUT = join(DIST, 'java', 'infinite_rail');
const BEDROCK_OUT = join(DIST, 'bedrock', 'InfiniteRail_BP');

if (!CHECK_ONLY) {
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });

  // Java: copy the edition tree, then drop the shared functions in verbatim.
  cpSync(SRC_JAVA, JAVA_OUT, { recursive: true });
  for (const [f, content] of shared) {
    writeFileSync(join(JAVA_OUT, 'data', 'infinite_rail', 'function', f), content);
  }

  // Bedrock: copy the edition tree, then inject the shared functions with the
  // one mechanical dialect rewrite (namespace colon -> folder slash).
  cpSync(SRC_BEDROCK, BEDROCK_OUT, { recursive: true });
  mkdirSync(join(BEDROCK_OUT, 'functions', 'infinite_rail'), { recursive: true });
  for (const [f, content] of shared) {
    const rewritten = content.replaceAll(/function infinite_rail:([a-z0-9_]+)/g, 'function infinite_rail/$1');
    writeFileSync(join(BEDROCK_OUT, 'functions', 'infinite_rail', f), rewritten);
  }
}

// ---------------------------------------------------------------------------
// 3. Validate the assembled packs (or the sources in --check mode).
// ---------------------------------------------------------------------------
function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

function validateJson(path) {
  try { JSON.parse(readFileSync(path, 'utf8')); }
  catch (e) { fail(`invalid JSON in ${path}: ${e.message}`); }
}

function validatePack(root, edition) {
  // Every function reference must resolve to a file in this pack.
  const fnDir = edition === 'java'
    ? join(root, 'data', 'infinite_rail', 'function')
    : join(root, 'functions');
  const overlayFnDir = join(root, 'overlay_snake', 'data', 'infinite_rail', 'function');
  const existsFn = (name) => {
    if (edition === 'java') {
      return existsSync(join(fnDir, `${name}.mcfunction`)) ||
        existsSync(join(overlayFnDir, `${name}.mcfunction`));
    }
    return existsSync(join(fnDir, ...`${name}.mcfunction`.split('/')));
  };
  const refRe = edition === 'java'
    ? /(?:^|run )function infinite_rail:([a-z0-9_]+)/gm
    : /(?:^|run )function ([a-z0-9_/]+)/gm;

  for (const file of walk(root)) {
    if (file.endsWith('.json') || file.endsWith('.mcmeta')) validateJson(file);
    if (!file.endsWith('.mcfunction')) continue;
    const text = readFileSync(file, 'utf8');
    for (const line of text.split('\n')) {
      if (line.trim().startsWith('#')) continue;
      for (const m of line.matchAll(refRe)) {
        if (!existsFn(m[1])) {
          fail(`${relative(ROOT, file)}: references missing function "${m[1]}"`);
        }
      }
    }
  }
}

if (CHECK_ONLY) {
  console.log(`shared dialect lint OK (${sharedFiles.length} shared functions)`);
  process.exit(0);
}

validatePack(JAVA_OUT, 'java');
validatePack(BEDROCK_OUT, 'bedrock');

// Sanity: the packs' entry metadata files must exist at their roots.
if (!existsSync(join(JAVA_OUT, 'pack.mcmeta'))) fail('Java pack has no pack.mcmeta');
if (!existsSync(join(BEDROCK_OUT, 'manifest.json'))) fail('Bedrock pack has no manifest.json');
if (!existsSync(join(BEDROCK_OUT, 'scripts', 'main.js'))) fail('Bedrock pack has no scripts/main.js');

// ---------------------------------------------------------------------------
// 4. Zip writer (store + deflate, fixed timestamps for reproducible output).
// ---------------------------------------------------------------------------
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

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

const javaZip = join(DIST, `InfiniteRail-Java-v${VERSION}.zip`);
const bedrockPack = join(DIST, `InfiniteRail-Bedrock-v${VERSION}.mcpack`);
zipDirectory(JAVA_OUT, javaZip);       // pack.mcmeta at zip root
zipDirectory(BEDROCK_OUT, bedrockPack); // manifest.json at zip root

const count = (d) => [...walk(d)].length;
console.log(`Infinite Rail v${VERSION}`);
console.log(`  shared functions injected: ${sharedFiles.length} (${sharedFiles.map((f) => f.replace('.mcfunction', '')).join(', ')})`);
console.log(`  Java pack:    ${relative(ROOT, JAVA_OUT)} (${count(JAVA_OUT)} files) -> ${relative(ROOT, javaZip)} (${statSync(javaZip).size} bytes)`);
console.log(`  Bedrock pack: ${relative(ROOT, BEDROCK_OUT)} (${count(BEDROCK_OUT)} files) -> ${relative(ROOT, bedrockPack)} (${statSync(bedrockPack).size} bytes)`);
