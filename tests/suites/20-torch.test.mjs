// Torch mode: the shared torch_auto day/night gate (exact night-window
// boundaries, clock wrapping, all three modes), the time_now predicate
// bridge, and -- the part that catches silent regressions -- whether torches
// PHYSICALLY appear beside freshly built track exactly when they should.
//
// The physical tests run four separate short rides on parallel strips
// (different Z), so each strip's torch count is isolated:
//   night + auto   -> torches expected
//   day   + auto   -> zero torches (any torch is a logic error)
//   night + off    -> zero torches
//   day   + always -> torches expected
//
// Torch density is pinned to the Max preset (100%) and .TORCHRANGE tightened
// so every built column should attempt a torch a couple of blocks off the
// centerline.

import { defineSuite, eq, ok, between } from '../lib/harness.mjs';
import { startRide, stopRide, lineZ } from '../lib/ride.mjs';

/** Is the chunk holding (x, z) forceloaded right now? */
async function chunkForced(mc, x, z) {
  const r = await mc.cmd(`forceload query ${Math.floor(x)} ${Math.floor(z)}`);
  if (/is not marked/.test(r)) return false;
  if (/is marked for force loading/.test(r)) return true;
  throw new Error(`forceload query: unexpected response ${JSON.stringify(r)}`);
}

const NIGHT_START = 12542;
const NIGHT_END = 23459;

async function gate(mc, mode, tod) {
  await mc.setScore('.TORCHMODE', 'ir', mode);
  await mc.setScore('.tod', 'ir', tod);
  await mc.fn('torch_auto');
  return mc.score('.torchlit', 'ir');
}

/** Build a short strip (just the launch runway) and count torch blocks near it. */
async function rideAndCountTorches(mc, z) {
  const { trackBase } = await startRide(mc, { z });
  const headX = await mc.score('.headX', 'ir');
  const len = await mc.trackLen();
  // y band: sample the profile, then scan generously below (torches sit on
  // the terrain surface, which may fall well below a bridged line).
  const ys = [];
  for (let i = 0; i < len; i += Math.max(1, Math.floor(len / 8))) ys.push(await mc.trackY(i));
  const yMin = Math.max(-60, Math.min(...ys) - 64);
  const yMax = Math.min(319, Math.max(...ys) + 16);
  await stopRide(mc); // clears the pack's forceloads; we manage our own below
  const [x1, x2] = [trackBase - 2, headX + 2];
  // The line snaps to Z ≡ 14 mod 16 -- scan around where the track IS.
  const [z1, z2] = [lineZ(z) - 7, lineZ(z) + 7];
  await mc.loadRegion(x1, z1, x2, z2, { settleMs: 1500 });
  const torches = await mc.countAndClearBlocks(x1, yMin, z1, x2, yMax, z2, 'minecraft:torch');
  const pickles = await mc.countAndClearBlocks(x1, yMin, z1, x2, yMax, z2, 'minecraft:sea_pickle');
  await mc.unloadRegion(x1, z1, x2, z2);
  return { columns: len, torches, pickles };
}

export default defineSuite('torch mode', ({ test }) => {
  // ---------- the shared gate, driven directly ----------

  test('auto mode lights exactly inside the night window 12542..23459', async ({ mc }) => {
    eq(await gate(mc, 2, NIGHT_START - 1), 0, 'one tick before dusk stays unlit');
    eq(await gate(mc, 2, NIGHT_START), 1, 'dusk boundary lights');
    eq(await gate(mc, 2, 18000), 1, 'midnight lights');
    eq(await gate(mc, 2, NIGHT_END), 1, 'last night tick lights');
    eq(await gate(mc, 2, NIGHT_END + 1), 0, 'first dawn tick goes dark');
    eq(await gate(mc, 2, 0), 0, 'morning unlit');
    eq(await gate(mc, 2, 6000), 0, 'noon unlit');
  });

  test('auto mode floor-mods a total-elapsed clock (26.1-era world clocks)', async ({ mc }) => {
    eq(await gate(mc, 2, 24000 + 18000), 1, 'day 2 midnight lights');
    eq(await gate(mc, 2, 24000 * 7 + 6000), 0, 'day 8 noon unlit');
  });

  test('always-on mode ignores the clock', async ({ mc }) => {
    eq(await gate(mc, 1, 6000), 1, 'noon lights in mode 1');
    eq(await gate(mc, 1, 0), 1, 'morning lights in mode 1');
  });

  test('off mode never lights', async ({ mc }) => {
    eq(await gate(mc, 0, 18000), 0, 'midnight stays unlit in mode 0');
  });

  test('time_now feeds the gate through the day/night predicates', async ({ mc }) => {
    await mc.cmd('time set 18000');
    await mc.fn('time_now');
    eq(await mc.score('.tod', 'ir'), 18000, 'night predicate -> representative night time');
    await mc.cmd('time set 6000');
    await mc.fn('time_now');
    eq(await mc.score('.tod', 'ir'), 6000, 'day predicate -> representative day time');
  });

  // ---------- physical placement beside real track ----------

  test('setup: pin density to Max and tighten the scatter range', async ({ mc }) => {
    await mc.fn('torch_density_max');
    eq(await mc.score('.torchdens', 'ir'), 100, 'Max preset = 100%');
    await mc.setScore('.TORCHRANGE', 'cfg_ride', 4);
    await mc.fn('mode_torches_auto');
    eq(await mc.score('.TORCHMODE', 'ir'), 2, 'auto mode');
  });

  test('night + auto: torches appear beside new track', async ({ mc, note }) => {
    await mc.cmd('time set 18000');
    const { columns, torches, pickles } = await rideAndCountTorches(mc, 0.5);
    note(`${columns} columns -> ${torches} torches, ${pickles} sea pickles`);
    ok(columns > 60, `expected a launch runway of columns, got ${columns}`);
    const planted = torches + pickles; // over water a torch becomes a pickle
    between(planted, Math.max(8, Math.floor(columns * 0.15)), columns + 5,
      `at Max density most columns should plant (got ${planted} of ${columns})`);
  });

  test('day + auto: ZERO torches appear (silent-failure check)', async ({ mc, note }) => {
    await mc.cmd('time set 6000');
    const { columns, torches, pickles } = await rideAndCountTorches(mc, 300.5);
    note(`${columns} columns -> ${torches} torches, ${pickles} sea pickles`);
    eq(torches, 0, 'auto mode must not plant torches during the day');
    eq(pickles, 0, 'auto mode must not plant sea pickles during the day');
  });

  test('night + off: ZERO torches appear', async ({ mc, note }) => {
    await mc.cmd('time set 18000');
    await mc.fn('mode_torches_off');
    const { columns, torches, pickles } = await rideAndCountTorches(mc, 600.5);
    note(`${columns} columns -> ${torches} torches, ${pickles} sea pickles`);
    eq(torches + pickles, 0, 'torch mode off must plant nothing, even at night');
  });

  test('day + always-on: torches appear around the clock', async ({ mc, note }) => {
    await mc.cmd('time set 6000');
    await mc.fn('mode_torches_on');
    const { columns, torches, pickles } = await rideAndCountTorches(mc, 900.5);
    note(`${columns} columns -> ${torches} torches, ${pickles} sea pickles`);
    const planted = torches + pickles;
    between(planted, Math.max(8, Math.floor(columns * 0.15)), columns + 5,
      `always-on plants regardless of daytime (got ${planted} of ${columns})`);
    await mc.fn('mode_torches_auto'); // restore the default
  });

  // ---------- the torch stub: the corridor only widens while torches plant ----------

  test('torch stub: wide chunks exist only at night (auto), only near the head', { timeout: 300000 }, async ({ mc, note }) => {
    // Realistic width again: ±30 spans multiple chunk rows, so wide-vs-
    // narrow is observable per chunk (the earlier tests pinned it to 4).
    await mc.setScore('.TORCHRANGE', 'cfg_ride', 30);
    await mc.cmd('time set 6000');
    const lz = lineZ(1200);
    const wideZ = lz + 24; // one-two chunk rows off the centerline: torch-band territory
    await startRide(mc, { z: 1200.5 });
    try {
      // Let a couple of 16-block rolls happen under daytime.
      await mc.sprint(200, { timeoutMs: 120000 });
      await mc.freeze();
      let headX = await mc.score('.headX', 'ir');
      eq(await chunkForced(mc, headX - 8, lz), true, 'the track row is always forceloaded');
      eq(await chunkForced(mc, headX - 8, wideZ), false, 'auto-mode DAY: no wide torch band is loaded (the old clock-blind cost)');
      await mc.unfreeze();
      // Night falls: the next built column refreshes .torchlit, the next
      // 16-block roll adds the wide stub around the head.
      await mc.cmd('time set 18000');
      await mc.sprint(200, { timeoutMs: 120000 });
      await mc.freeze();
      headX = await mc.score('.headX', 'ir');
      eq(await chunkForced(mc, headX - 8, wideZ), true, 'auto-mode NIGHT: the torch band near the head is loaded');
      eq(await chunkForced(mc, headX + 100, wideZ), false, 'the stub is SHORT: no wide band rides the full corridor reach');
      eq(await chunkForced(mc, headX + 100, lz), true, 'while the narrow track row still reaches deep ahead');
      await mc.unfreeze();
      // Dawn: new rolls stop adding wide chunks (the band behind drains via
      // the normal release band as the ride moves on).
      await mc.cmd('time set 6000');
      await mc.sprint(400, { timeoutMs: 180000 });
      await mc.freeze();
      headX = await mc.score('.headX', 'ir');
      eq(await chunkForced(mc, headX - 8, wideZ), false, 'auto-mode day again: fresh rolls are narrow');
      await mc.unfreeze();
      note('corridor shape verified by forceload query: row deep + stub wide at night, row only by day');
    } finally {
      await mc.unfreeze().catch(() => {});
      await stopRide(mc);
    }
  });
});
