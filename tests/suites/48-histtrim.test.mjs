// The track-history trim (hist_trim): the camera's profile list must stay
// bounded (~2048 entries, like Bedrock's HIST_MAX) instead of growing for
// the life of a ride -- while .trackBase advances in lockstep so every
// consumer keeps reading the same world X at the same index.

import { defineSuite, eq, ok, between } from '../lib/harness.mjs';
import { startRide, stopRide } from '../lib/ride.mjs';

export default defineSuite('track history trim', ({ test }) => {
  test('mechanism: over-long history drains, base advances in lockstep', { timeout: 120000 }, async ({ mc }) => {
    // Unit-style: craft an oversized history directly (no ride involved --
    // hist_trim is pure storage + score math) by doubling a seed list.
    await mc.cmd(`data modify storage infinite_rail:track y set value [${Array(33).fill(64).join(',')}]`);
    for (let i = 0; i < 12 && (await mc.trackLen()) <= 2100; i++) {
      await mc.cmd('data modify storage infinite_rail:track big set from storage infinite_rail:track y');
      await mc.cmd('data modify storage infinite_rail:track y append from storage infinite_rail:track big[]');
    }
    await mc.cmd('data remove storage infinite_rail:track big');
    const len0 = await mc.trackLen();
    ok(len0 > 2100, `seeded an oversized history (${len0} entries)`);
    await mc.setScore('.trackBase', 'ir', 1000);

    await mc.cmd('function infinite_rail:hist_trim');
    eq(await mc.trackLen(), len0 - 2, 'one call drops two oldest entries while oversized');
    eq(await mc.score('.trackBase', 'ir'), 1002, '.trackBase advanced with the drops');

    // Drain the rest and confirm it settles exactly at the bound.
    for (let i = 0; i < Math.ceil((len0 - 2 - 2048) / 2) + 3; i++) {
      await mc.cmd('function infinite_rail:hist_trim');
    }
    eq(await mc.trackLen(), 2048, 'drained history settles at 2048');
    const base = await mc.score('.trackBase', 'ir');
    await mc.cmd('function infinite_rail:hist_trim');
    eq(await mc.trackLen(), 2048, 'at the bound the trim is a no-op');
    eq(await mc.score('.trackBase', 'ir'), base, 'base stops moving at the bound');
    await mc.cmd('data modify storage infinite_rail:track y set value []');
  });

  test('end to end: a long ride holds the bound and stays self-consistent', { timeout: 480000 }, async ({ mc, note }) => {
    const { trackBase: base0 } = await startRide(mc);
    // Let the builder run far ahead so the ride crosses the 2048-column
    // bound quickly (the gap condition is the only throttle on .BUILD_PER_TICK).
    // Progress is measured against the ride's ORIGINAL anchor -- .trackBase
    // itself advances once the trim engages (that's the feature).
    await mc.cmd('scoreboard players set .PACE_CART_BEHIND cfg_ride 100000');
    for (let i = 0; i < 6; i++) {
      await mc.sprint(200, { timeoutMs: 240000 });
      if ((await mc.score('.headX', 'ir')) - base0 >= 2100) break;
    }
    await mc.freeze();
    try {
      const headX = await mc.score('.headX', 'ir');
      const base = await mc.score('.trackBase', 'ir');
      const len = await mc.trackLen();
      note(`head at x=${headX}, base=${base}, history=${len}`);
      between(len, 2048, 2049, 'history bounded at ~2048 entries');
      eq(base + len - 1, headX, 'newest entry still maps to the head (index = X - base)');
      eq(await mc.trackY(len - 1), await mc.score('.railY', 'ir'), 'newest entry is the current rail Y');
    } finally {
      await mc.unfreeze();
      await mc.cmd('scoreboard players set .PACE_CART_BEHIND cfg_ride 224');
    }
    await stopRide(mc);
  });
});
