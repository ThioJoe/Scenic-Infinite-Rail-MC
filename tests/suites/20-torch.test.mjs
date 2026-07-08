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
import { startRide, stopRide } from '../lib/ride.mjs';

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
  const [z1, z2] = [Math.floor(z) - 7, Math.floor(z) + 7];
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
});
