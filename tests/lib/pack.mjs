// Resolve the pack under test (built artifact zip, pack folder, or a fresh
// build from src/) and derive expected values from the pack's own sources.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { extractZip } from './zip.mjs';

/** Find the directory containing pack.mcmeta, up to a few levels deep. */
function findPackRoot(dir, depth = 3) {
  if (fs.existsSync(path.join(dir, 'pack.mcmeta'))) return dir;
  if (depth === 0) return null;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const found = findPackRoot(path.join(dir, entry.name), depth - 1);
      if (found) return found;
    }
  }
  return null;
}

/**
 * @param packArg  --pack value: a .zip (build artifact), a pack directory,
 *                 or undefined = build from the repo source via tools/build.mjs.
 * @returns absolute path of a directory whose root holds pack.mcmeta
 */
export function resolvePack(packArg, { repoRoot, workDir }) {
  if (!packArg) {
    const build = spawnSync('node', [path.join(repoRoot, 'tools', 'build.mjs')], { cwd: repoRoot, encoding: 'utf8' });
    if (build.status !== 0) {
      throw new Error(`tools/build.mjs failed:\n${build.stdout}\n${build.stderr}`);
    }
    const built = path.join(repoRoot, 'dist', 'java', 'Scenic_Infinite_Rail_Mode');
    if (!fs.existsSync(path.join(built, 'pack.mcmeta'))) {
      throw new Error(`build produced no pack at ${built}`);
    }
    return built;
  }
  const abs = path.resolve(packArg);
  if (!fs.existsSync(abs)) throw new Error(`--pack not found: ${abs}`);
  if (fs.statSync(abs).isDirectory()) {
    const root = findPackRoot(abs);
    if (!root) throw new Error(`no pack.mcmeta found under ${abs}`);
    return root;
  }
  if (abs.endsWith('.zip')) {
    const dest = path.join(workDir, 'pack-under-test');
    fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync(dest, { recursive: true });
    extractZip(abs, dest);
    const root = findPackRoot(dest);
    if (!root) throw new Error(`no pack.mcmeta found inside ${abs}`);
    return root;
  }
  throw new Error(`--pack must be a directory or .zip: ${abs}`);
}

/**
 * Parse the pack's own config.mcfunction + consts.mcfunction so the boot
 * suite asserts *whatever the pack ships*, not hardcoded copies that drift.
 * Returns { entries: [{holder, objective, value}], get(holder) }
 */
export function parseExpectedConfig(packDir) {
  const fnDir = path.join(packDir, 'data', 'infinite_rail', 'function');
  const entries = [];
  for (const file of ['config.mcfunction', 'consts.mcfunction']) {
    const p = path.join(fnDir, file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^scoreboard players set (\.[A-Za-z0-9_]+) ([A-Za-z0-9_]+) (-?\d+)\s*$/);
      if (m) entries.push({ holder: m[1], objective: m[2], value: parseInt(m[3], 10), source: file });
    }
  }
  return {
    entries,
    get(holder) {
      const e = entries.find((x) => x.holder === holder);
      return e ? e.value : undefined;
    },
  };
}
