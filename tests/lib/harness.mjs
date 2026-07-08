// Tiny zero-dependency test harness: suites, tests, assertions, skip.
//
// A suite file looks like:
//
//   import { defineSuite, eq, ok } from '../lib/harness.mjs';
//   export default defineSuite('my feature', ({ test }) => {
//     test('does the thing', async (ctx) => {
//       eq(await ctx.mc.score('.speed', 'ir'), 8, 'default speed');
//     });
//   });
//
// Each suite gets a freshly-created world on a freshly-booted server; tests
// within a suite run in order and share that world (so later tests may build
// on earlier ones -- keep suites self-contained).

export class AssertionError extends Error {}
export class SkipError extends Error {}

export function defineSuite(name, optsOrBuild, maybeBuild) {
  const opts = typeof optsOrBuild === 'object' ? optsOrBuild : {};
  const build = typeof optsOrBuild === 'function' ? optsOrBuild : maybeBuild;
  const tests = [];
  build({
    test(testName, a, b) {
      // accept both test(name, fn, opts) and test(name, opts, fn)
      const fn = typeof a === 'function' ? a : b;
      const opts = (typeof a === 'function' ? b : a) ?? {};
      tests.push({ name: testName, fn, opts });
    },
  });
  return { name, opts, tests };
}

export function skip(reason) {
  throw new SkipError(reason);
}

export function fail(msg) {
  throw new AssertionError(msg);
}

export function ok(value, msg) {
  if (!value) throw new AssertionError(`${msg ?? 'expected truthy'} (got ${JSON.stringify(value)})`);
}

export function eq(actual, expected, msg) {
  if (actual !== expected) {
    throw new AssertionError(`${msg ?? 'values differ'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function neq(actual, notExpected, msg) {
  if (actual === notExpected) {
    throw new AssertionError(`${msg ?? 'values must differ'}: got ${JSON.stringify(actual)}`);
  }
}

export function between(value, min, max, msg) {
  if (typeof value !== 'number' || value < min || value > max) {
    throw new AssertionError(`${msg ?? 'out of range'}: expected ${min}..${max}, got ${JSON.stringify(value)}`);
  }
}

export function closeTo(value, target, tolerance, msg) {
  if (typeof value !== 'number' || Math.abs(value - target) > tolerance) {
    throw new AssertionError(`${msg ?? 'not close enough'}: expected ${target}±${tolerance}, got ${JSON.stringify(value)}`);
  }
}

export function includes(haystack, needle, msg) {
  if (typeof haystack !== 'string' || !haystack.includes(needle)) {
    throw new AssertionError(`${msg ?? 'missing substring'}: expected to find ${JSON.stringify(needle)} in ${JSON.stringify(String(haystack).slice(0, 300))}`);
  }
}

/** Run one suite's tests against a prepared ctx. Returns result records. */
export async function runSuite(suite, ctx, { filter, defaultTimeoutMs = 180000, onResult } = {}) {
  const results = [];
  for (const t of suite.tests) {
    if (filter && !suite.name.toLowerCase().includes(filter) && !t.name.toLowerCase().includes(filter)) {
      continue;
    }
    const started = Date.now();
    const record = { suite: suite.name, test: t.name, status: 'passed', ms: 0, detail: '', notes: [] };
    ctx.note = (msg) => { record.notes.push(String(msg)); };
    const timeoutMs = t.opts.timeout ?? defaultTimeoutMs;
    try {
      await Promise.race([
        t.fn(ctx),
        new Promise((_, rej) => setTimeout(() => rej(new AssertionError(`test timed out after ${timeoutMs / 1000}s`)), timeoutMs)),
      ]);
    } catch (err) {
      if (err instanceof SkipError) {
        record.status = 'skipped';
        record.detail = err.message;
      } else {
        record.status = 'failed';
        record.detail = err instanceof AssertionError ? err.message : (err.stack || String(err));
      }
    }
    record.ms = Date.now() - started;
    results.push(record);
    onResult?.(record);
    // A dead server invalidates everything after it in this suite.
    if (ctx.server?.exited && record.status !== 'failed') {
      record.status = 'failed';
      record.detail += ' [server process exited unexpectedly]';
    }
    if (ctx.server?.exited) break;
  }
  return results;
}
