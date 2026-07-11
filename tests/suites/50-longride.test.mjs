// Endurance: let the ride run for minutes of game time over fresh terrain
// and assert the invariants that must hold "forever" -- the ride keeps
// going, the line stays contiguous, the world matches the recorded profile,
// the rig keeps flying, nothing stalls and nothing errors.

import { defineSuite, eq, ok, between, closeTo } from '../lib/harness.mjs';
import { startRide, summonRig, checkColumn, stopRide } from '../lib/ride.mjs';

const SPRINT_TICKS = 2400; // two minutes of game time

export default defineSuite('long ride endurance', ({ test }) => {
  test(`ride survives ${SPRINT_TICKS} ticks and keeps building`, { timeout: 420000 }, async ({ mc, state, note }) => {
    const { trackBase } = await startRide(mc);
    await summonRig(mc);
    state.trackBase = trackBase;
    state.errMark = 0;
    const h0 = await mc.score('.headX', 'ir');
    await mc.sprint(SPRINT_TICKS, { timeoutMs: 360000 });
    eq(await mc.score('.started', 'ir'), 1, 'ride still running');
    const h1 = await mc.score('.headX', 'ir');
    state.headX = h1;
    note(`built ${h1 - trackBase} columns total (${h1 - h0} during the sprint)`);
    ok(h1 - h0 > 400, `expected sustained building during the sprint (got ${h1 - h0} columns)`);
  });

  test('pace cart travelled with the build front', async ({ mc, note }) => {
    const cartX = await mc.entityNum('@e[type=minecart,tag=ir_cart,limit=1]', 'Pos[0]');
    ok(cartX !== null, 'pace cart alive');
    ok(cartX - (await mc.score('.trackBase', 'ir')) > 300, `cart should be far east by now (at x=${cartX?.toFixed(0)})`);
    note(`cart x=${cartX?.toFixed(1)}, gap=${await mc.score('.gap', 'ir')}`);
  });

  test('head stayed selectable for the whole run (.hdmiss = 0)', async ({ mc }) => {
    eq(await mc.score('.hdmiss', 'ir'), 0, 'building never paused on unloaded chunks');
  });

  test('build gap bounded by .AHEAD for the whole run endpoint', async ({ mc }) => {
    const gap = await mc.score('.gap', 'ir');
    const ahead = await mc.score('.PACE_CART_BEHIND', 'cfg_ride');
    const maxTick = await mc.score('.BUILD_PER_TICK', 'cfg_ride');
    between(gap, 1, ahead + maxTick, '.gap within bounds');
  });

  test('profile stays contiguous across the whole run (sampled pairs)', { timeout: 240000 }, async ({ mc, note }) => {
    const len = await mc.trackLen();
    const bad = [];
    let minY = Infinity; let maxY = -Infinity;
    const stride = Math.max(1, Math.floor(len / 40));
    for (let i = 0; i + 1 < len; i += stride) {
      const a = await mc.trackY(i);
      const b = await mc.trackY(i + 1);
      if (Math.abs(b - a) > 1) bad.push(`i=${i}: ${a} -> ${b}`);
      minY = Math.min(minY, a); maxY = Math.max(maxY, b);
    }
    note(`sampled ${Math.floor(len / stride)} pairs over ${len} columns, Y span ${minY}..${maxY}`);
    eq(bad.length, 0, `contiguity breaks: ${bad.slice(0, 5).join('; ')}`);
  });

  test('world matches the history at spot checks along the whole line', { timeout: 300000 }, async ({ mc, state }) => {
    const base = await mc.score('.trackBase', 'ir');
    const len = await mc.trackLen();
    const bad = [];
    for (const frac of [0.05, 0.2, 0.4, 0.6, 0.8, 0.95]) {
      const i = Math.floor(frac * (len - 1));
      const x = base + i;
      const y = await mc.trackY(i);
      const prevY = i > 0 ? await mc.trackY(i - 1) : y;
      await mc.loadRegion(x - 1, -2, x + 1, 2, { settleMs: 900 });
      const col = await checkColumn(mc, x, y, 0, prevY);
      if (col.rail !== 'match' || col.support !== 'match' || col.light !== 'match') {
        bad.push(`x=${x} y=${y}: rail=${col.rail} support=${col.support} light=${col.light}`);
      }
      await mc.unloadRegion(x - 1, -2, x + 1, 2);
    }
    eq(bad.length, 0, `physical/virtual divergence: ${bad.join('; ')}`);
  });

  test('camera rig still glides the profile after the long run', async ({ mc }) => {
    const seatX = await mc.entityNum('@e[type=item_display,tag=ir_seat,limit=1]', 'Pos[0]');
    const seatY = await mc.entityNum('@e[type=item_display,tag=ir_seat,limit=1]', 'Pos[1]');
    const cartX = await mc.entityNum('@e[type=minecart,tag=ir_cart,limit=1]', 'Pos[0]');
    ok(seatX !== null && cartX !== null, 'rig + cart alive');
    const camAhead = (await mc.score('.PACE_CART_BEHIND', 'cfg_ride')) - (await mc.score('.RIDER_BEHIND', 'cfg_camera'));
    closeTo(seatX - cartX, camAhead, 2.5, 'seat still the rig lead ahead of the pace cart');
    const base = await mc.score('.trackBase', 'ir');
    const idx = Math.min(await mc.trackLen() - 1, Math.max(0, Math.floor(seatX) - base));
    const lineY = await mc.trackY(idx);
    const lift = (await mc.score('.CAMLIFT', 'cfg_camera')) / 10;
    const height = (await mc.score('.CAMHEIGHT', 'cfg_camera')) / 10;
    between(seatY - lineY, -1.5, lift + height + 2.5, `seat Y ${seatY} vs rail line Y ${lineY}`);
  });

  test('no unexpected server errors across the long run', async ({ mc, server }) => {
    await stopRide(mc);
    const errs = server.errorsSince(0, { alsoIgnore: [/Failed to load function/] });
    eq(errs.length, 0, `unexpected ERROR lines: ${errs.slice(0, 5).join(' | ')}`);
  });
});
