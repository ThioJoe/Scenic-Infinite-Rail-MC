// Perf-investigation suite -- burst-processing measurement for the
// roll_chunks pipeline (tick-time percentiles around the 16-block roll,
// decomposed into fresh-generation vs unload halves). Produces notes, not
// pass/fail thresholds -- numbers are hardware-relative, so it is SKIPPED
// unless explicitly requested:
//   SIRM_PERF=1 node tests/run.mjs --filter perf
// To simulate a weak device, pin the server to one core via a PATH shim
// (a `java` wrapper doing `exec taskset -c 0 /usr/bin/java "$@"`).

import { defineSuite, ok, skip } from '../lib/harness.mjs';
import { startRide, summonRig } from '../lib/ride.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tickQuery(mc) {
  const r = await mc.cmd('tick query');
  const num = (re) => {
    const m = r.match(re);
    return m ? parseFloat(m[1]) : NaN;
  };
  return {
    avg: num(/time per tick: ([\d.]+)ms/i),
    p50: num(/P50: ([\d.]+)ms/i),
    p95: num(/P95: ([\d.]+)ms/i),
    p99: num(/P99: ([\d.]+)ms/i),
    raw: r,
  };
}

async function sampleWindow(mc, windowMs, pollMs = 400) {
  const samples = [];
  const h0 = await mc.score('.headX', 'ir');
  const t0 = Date.now();
  while (Date.now() - t0 < windowMs) {
    const q = await tickQuery(mc);
    if (Number.isFinite(q.p99)) samples.push(q);
    await sleep(pollMs);
  }
  const h1 = await mc.score('.headX', 'ir');
  return { samples, blocks: h1 - h0, secs: (Date.now() - t0) / 1000 };
}

function stats(samples, key) {
  const v = samples.map((s) => s[key]).filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return { n: 0 };
  const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
  return { n: v.length, med: q(0.5), max: v[v.length - 1] };
}

function fmt(name, w) {
  const p50 = stats(w.samples, 'p50');
  const p95 = stats(w.samples, 'p95');
  const p99 = stats(w.samples, 'p99');
  const avg = stats(w.samples, 'avg');
  const bps = (w.blocks / w.secs).toFixed(1);
  return `${name}: n=${p99.n} ${w.blocks}bl @${bps}b/s | avg med=${avg.med} | p50 med=${p50.med} | p95 med=${p95.med} max=${p95.max} | p99 med=${p99.med} max=${p99.max}`;
}

export default defineSuite('perf (burst investigation)', ({ test }) => {
  test('decompose roll burst: gen+unload vs unload-only vs none', { timeout: 600000 }, async (ctx) => {
    if (!process.env.SIRM_PERF) skip('perf investigation suite; set SIRM_PERF=1 to run');
    let ok0 = false;
    for (let i = 0; i < 3 && !ok0; i++) {
      try { await startRide(ctx.mc); ok0 = true; } catch (e) {
        ctx.note(`startRide retry ${i + 1}: ${e.message}`);
        await sleep(5000);
      }
    }
    if (!ok0) throw new Error('ride never started');
    await summonRig(ctx.mc);
    const mc = ctx.mc;
    // Settle until the track buffer is full (steady-state cruise, not
    // catch-up): gap = headX - cartX ~= .PACE_CART_BEHIND.
    for (let i = 0; i < 60; i++) {
      const gap = (await mc.score('.headX', 'ir')) - Math.floor((await mc.storeResult('data get entity @e[type=minecart,tag=ir_cart,limit=1] Pos[0]')));
      if (gap >= 220) break;
      await sleep(2000);
    }
    ctx.note('steady state reached');

    // Window A: steady cruise, rolls active (fresh gen + unloads).
    const A = await sampleWindow(mc, 30000);
    ctx.note(fmt('A rolls gen+unload', A));

    // Window D: pre-force the corridor far ahead -> the roll's adds become
    // no-ops (no fresh generation); what remains on roll ticks is the
    // remove band's unload work + the trivia (kill sweep, spawn moves).
    const z = await mc.score('.lineZ', 'ir');
    const h0 = await mc.score('.headX', 'ir');
    await mc.cmd(`forceload add ${h0 - 16} ${z - 17} ${h0 + 700} ${z + 17}`);
    await sleep(25000); // generation finishes; also flushes the sample window
    const D = await sampleWindow(mc, 30000);
    ctx.note(fmt('D rolls unload-only', D));

    // Window B: rolls fully disabled (control). Corridor is pre-forced far
    // ahead so the builder never starves.
    const headB = await mc.score('.headX', 'ir');
    await mc.setScore('.nextLoad', 'ir', headB + 100000);
    await sleep(6000);
    const B = await sampleWindow(mc, 20000);
    ctx.note(fmt('B no rolls        ', B));
    // Restore rolls.
    const headB2 = await mc.score('.headX', 'ir');
    await mc.setScore('.nextLoad', 'ir', headB2 - (headB2 % 16) + 16);
    await sleep(4000);

    // Window E: ocean-sprint speed (32 b/s) with real generation -- the
    // worst realistic case (rolls every ~10 ticks). The pre-forced strip
    // ends ~+700 from window D's start; the ride crosses beyond it here.
    await mc.cmd('gamerule minecartMaxSpeed 32');
    await sleep(8000);
    const E = await sampleWindow(mc, 25000);
    ctx.note(fmt('E rolls @32b/s     ', E));
    await mc.cmd('gamerule minecartMaxSpeed 8');

    const rescues = await mc.score('.wdfixn', 'ir');
    ctx.note(`watchdog rescues during test: ${rescues ?? 0}`);
    ok(A.samples.length > 10, 'window A sampled');
  });
});
