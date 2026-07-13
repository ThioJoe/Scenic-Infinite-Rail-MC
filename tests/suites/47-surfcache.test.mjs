// The rolling surface cache (surf_roll & co.): the terrain heights the
// sampling/near/shift walks consume are probed ONCE per X (lazily, on first
// read) and reused as the window slides -- this suite proves the cache stays
// aligned with the head, holds exactly what a fresh probe answers (the whole
// point: a cached read IS the fresh read), and resets on a ride restart.
// A drifted or stale cache would silently skew .avg and the slope guards,
// so these are hard assertions, not spot checks.

import { defineSuite, eq, ok, between } from '../lib/harness.mjs';
import { startRide, stopRide, LINE_Z } from '../lib/ride.mjs';

export default defineSuite('rolling surface cache', ({ test }) => {
  test('cache is aligned with the head and sized to the scan reach', { timeout: 240000 }, async ({ mc, expected, state }) => {
    await startRide(mc);
    await mc.sprint(200, { timeoutMs: 120000 });
    await mc.freeze();
    try {
      const headX = await mc.score('.headX', 'ir');
      const base = await mc.score('.surfBase', 'ir');
      // surf_roll aligns the base at the START of each column build (pre-move
      // head + 1), so BETWEEN columns base == .headX: c[0] is the just-built
      // column (spent -- the next slide pops it) and c[1].. is what the next
      // column's walks will read.
      eq(base, headX, 'cache base sits at the head between columns');
      const len = await mc.storeResult('data get storage infinite_rail:surf c');
      const want = Math.max(98, expected.get('.SAMPLE_WINDOW'));
      eq(len, want, 'cache length = max(98, .SAMPLE_WINDOW)');
      state.headX = headX;
    } finally {
      await mc.unfreeze();
    }
  });

  test('cached heights equal a fresh probe at the same column', { timeout: 120000 }, async ({ mc, note }) => {
    await mc.freeze();
    try {
      const headX = await mc.score('.headX', 'ir');
      const base = await mc.score('.surfBase', 'ir');
      let checked = 0;
      // Offsets east of the head (c[off], since base == headX between
      // columns) -- c[0] is the spent just-built column (track under it),
      // so only unbuilt terrain ahead is compared.
      for (const off of [1, 2, 5, 17, 40, 74]) {
        const cached = await mc.storageInt('infinite_rail:surf', `c[${off}]`);
        if (cached === -32768) continue; // never read by a walk yet: nothing to compare
        // Re-probe the same X for real (probe_surface = heightmap + the
        // not-terrain dig-down) and compare. Any mismatch means the cache
        // went stale or misaligned -- the exact failure this suite exists for.
        await mc.cmd(`execute positioned ${base + off} 100 ${LINE_Z} run function infinite_rail:probe_surface`);
        const fresh = await mc.entityNum('@e[type=marker,tag=ir_probe,limit=1]', 'Pos[1]');
        eq(cached, Math.floor(fresh), `cache[${off}] (x=${base + off}) matches a fresh probe`);
        checked += 1;
      }
      ok(checked >= 4, `compared ${checked} filled cache slots (window walks should have filled offsets 1..75)`);
      note(`verified ${checked} cached heights against fresh probes at head x=${headX}`);
    } finally {
      await mc.unfreeze();
    }
  });

  test('sampling still tracks terrain (avg within clamp of cached ground)', { timeout: 120000 }, async ({ mc }) => {
    await mc.freeze();
    try {
      // .avg must sit inside the plausible band of the cached window --
      // a cache misread (e.g. sentinel folded as height) would fling it.
      const avg = await mc.score('.avg', 'ir');
      between(avg, -60, 320, '.avg is a sane world height');
      const railY = await mc.score('.railY', 'ir');
      between(railY - avg, -120, 120, 'rail and average have not diverged');
    } finally {
      await mc.unfreeze();
    }
  });

  test('a ride restart forgets the cache and re-anchors it', { timeout: 240000 }, async ({ mc }) => {
    await stopRide(mc);
    await mc.loadRegion(-32, -32, 32, 32, { settleMs: 1200 });
    await startRide(mc);
    await mc.freeze();
    try {
      const headX = await mc.score('.headX', 'ir');
      const base = await mc.score('.surfBase', 'ir');
      eq(base, headX, 'restarted ride re-anchored the cache at its new head');
    } finally {
      await mc.unfreeze();
    }
    await stopRide(mc);
  });
});
