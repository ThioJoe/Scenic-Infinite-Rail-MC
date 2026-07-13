#!/usr/bin/env node
// =============================================================================
//  Version checks for the Infinite Rail monorepo
//
//  The single source of truth for the project's version is header.version in
//  src/bedrock/bp/manifest.json (Java's pack.mcmeta carries only a Minecraft
//  compatibility pack_format, not a product version, so it takes no part here).
//  Every other product-version reference in the two Bedrock manifests must
//  match it, and each release must bump it past the previous release tag.
//
//  Two modes, both emitting GitHub Actions ::error:: annotations on failure:
//
//    node tools/check-version.mjs --consistency
//        BLOCKING. Fails (exit 1) if any version reference disagrees with the
//        source of truth. CI gates the artifact upload on this passing.
//
//    node tools/check-version.mjs --release
//        NON-BLOCKING (for artifacts). Fails (exit 1) if the source-of-truth
//        version is not strictly greater than the highest existing release tag
//        (tags named "1.4.6" or "v1.4.6"). CI still uploads the build, but the
//        job reports failure so an un-bumped version can't ship unnoticed.
//        No tags yet -> treated as the first release, passes.
//
//  build.mjs imports collectRefs()/findMismatches() so a local build catches
//  version drift too. Zero dependencies.
// =============================================================================

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BP_REL = 'src/bedrock/bp/manifest.json';
const RP_REL = 'src/bedrock/rp/manifest.json';

// GitHub Actions annotation. Prints a plain line too so local runs are readable.
const annotate = (title, msg) => {
  console.log(`::error title=${title}::${msg}`);
  console.error(`  ${title}: ${msg}`);
};

// ---------------------------------------------------------------------------
// Gather every product-version reference in the two Bedrock manifests, tagged
// with a human label and the file it lives in. The BP header version is the
// source of truth; everything else is compared against it.
//
// External module-dependency pins (@minecraft/server, @minecraft/server-ui)
// and min_engine_version are NOT product versions and are deliberately skipped.
// ---------------------------------------------------------------------------
export function collectRefs(root = ROOT) {
  const bp = JSON.parse(readFileSync(join(root, BP_REL), 'utf8'));
  const rp = JSON.parse(readFileSync(join(root, RP_REL), 'utf8'));
  const v = (arr) => (Array.isArray(arr) ? arr.join('.') : String(arr));

  const sot = v(bp.header.version);
  const refs = [];

  // BP: every module's version, plus the dependency that points at the RP.
  (bp.modules ?? []).forEach((m, i) => {
    refs.push({ file: BP_REL, label: `BP module[${i}] (${m.type})`, version: v(m.version) });
  });
  const rpDep = (bp.dependencies ?? []).find((d) => d.uuid);
  if (rpDep) {
    refs.push({ file: BP_REL, label: 'BP dependency on RP', version: v(rpDep.version) });
  }

  // RP: its own header + every module.
  refs.push({ file: RP_REL, label: 'RP header', version: v(rp.header.version) });
  (rp.modules ?? []).forEach((m, i) => {
    refs.push({ file: RP_REL, label: `RP module[${i}] (${m.type})`, version: v(m.version) });
  });

  // Identity guard: the BP->RP dependency must name the RP header uuid, else
  // the version match above is checking against the wrong pack.
  const uuidMismatch =
    rpDep && rp.header?.uuid && rpDep.uuid !== rp.header.uuid
      ? { file: BP_REL, expected: rp.header.uuid, actual: rpDep.uuid }
      : null;

  return { sot, sotFile: BP_REL, refs, uuidMismatch };
}

export function findMismatches(info = collectRefs()) {
  return info.refs.filter((r) => r.version !== info.sot);
}

// ---------------------------------------------------------------------------
// Highest existing release, read from git tags (name form "1.4.6" or "v1.4.6").
// Returns { tag, parts:[maj,min,pat] } or null when there are no release tags.
// ---------------------------------------------------------------------------
const parseTag = (tag) => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(tag.trim());
  return m ? { tag: tag.trim(), parts: [+m[1], +m[2], +m[3]] } : null;
};

const cmp = (a, b) => {
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
  }
  return 0;
};

export function latestReleaseTag(root = ROOT) {
  let out = '';
  try {
    out = execSync('git tag -l', { cwd: root, encoding: 'utf8' });
  } catch {
    return null; // no git / no tags reachable
  }
  const parsed = out.split('\n').map(parseTag).filter(Boolean);
  if (!parsed.length) return null;
  parsed.sort((a, b) => cmp(b.parts, a.parts)); // descending
  return parsed[0];
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function runConsistency() {
  const info = collectRefs();
  console.log(`Version source of truth (BP header): ${info.sot}  [${info.sotFile}]`);
  for (const r of info.refs) {
    console.log(`  ${r.version === info.sot ? 'ok      ' : 'MISMATCH'}  ${r.label}: ${r.version}`);
  }

  const mismatches = findMismatches(info);
  for (const r of mismatches) {
    annotate(
      'Version mismatch',
      `${r.label} is ${r.version} but the source of truth is ${info.sot} (${r.file}). ` +
        `Set it to ${info.sot}.`,
    );
  }
  if (info.uuidMismatch) {
    annotate(
      'Version dependency uuid mismatch',
      `The BP->RP dependency uuid ${info.uuidMismatch.actual} does not match the RP header uuid ` +
        `${info.uuidMismatch.expected} (${info.uuidMismatch.file}).`,
    );
  }

  if (mismatches.length || info.uuidMismatch) {
    console.error(
      `\nVersion consistency check FAILED: ${mismatches.length} mismatched reference(s)` +
        `${info.uuidMismatch ? ' + a dependency uuid mismatch' : ''}. ` +
        `Artifacts will not be uploaded.`,
    );
    process.exit(1);
  }
  console.log('Version consistency OK.');
}

function runRelease() {
  const info = collectRefs();
  const latest = latestReleaseTag();
  if (!latest) {
    console.log('No release tags found; treating this as the first release. OK.');
    return;
  }
  const sotParts = info.sot.split('.').map(Number);
  if (cmp(sotParts, latest.parts) > 0) {
    console.log(`Version ${info.sot} is greater than the latest release ${latest.tag}. OK.`);
    return;
  }
  annotate(
    'Version not bumped',
    `Manifest version ${info.sot} is not greater than the latest release tag ${latest.tag}. ` +
      `Bump header.version in ${info.sotFile} (and its matching references) before releasing.`,
  );
  console.error('\nRelease version check FAILED (non-blocking: artifacts are still uploaded).');
  process.exit(1);
}

// Run only when invoked directly, not when imported by build.mjs.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--release')) runRelease();
  else if (process.argv.includes('--consistency')) runConsistency();
  else {
    console.error('Usage: node tools/check-version.mjs [--consistency | --release]');
    process.exit(2);
  }
}
