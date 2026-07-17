// Invisible track (mode_hidetrack_* / .HIDETRACK, CONTEXT 6.9): columns
// built while the mode is on get NO visible rail/support (the light block
// and the carve still happen, the history still records), previously built
// track keeps its rails, and the hidden pace cart keeps rolling anyway on
// the just-in-time strip (invis_tick & co.) -- placed a few columns ahead
// of it, wiped behind it, never left permanently in the world.
//
// The "no rail" assertions are made meaningful by a control check first
// (the negative hypothesis): the SAME detector must find rails on normal
// track before the toggle, so an empty world / wrong-Y probe can't
// false-pass the invisible checks.

import { defineSuite, eq, ok, between } from '../lib/harness.mjs';
import { startRide, stopRide, LINE_Z } from '../lib/ride.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The physical rail level of column x: the history records EXIT heights, a
// climbing column's blocks sit one below its recorded height, so the rail
// of column i is min(y[i-1], y[i]) (place_up's rule, same as checkColumn).
async function railLevel(mc, x) {
  const base = await mc.score('.trackBase', 'ir');
  const i = x - base;
  if (i < 0) throw new Error(`column ${x} predates the history (base ${base})`);
  const y1 = await mc.trackY(i);
  const y0 = i > 0 ? await mc.trackY(i - 1) : y1;
  return Math.min(y0, y1);
}

// What one column physically holds: rail / support / light as 'match' |
// 'nomatch' | 'unloaded' triplet at the recorded level.
async function columnBlocks(mc, x) {
  const y = await railLevel(mc, x);
  return {
    y,
    rail: await mc.blockIs(x, y, LINE_Z, 'minecraft:powered_rail'),
    support: await mc.blockIs(x, y - 1, LINE_Z, 'minecraft:redstone_block'),
    light: await mc.blockIs(x, y + 3, LINE_Z, 'minecraft:light'),
  };
}

export default defineSuite('invisible track (.HIDETRACK)', ({ test }) => {
  test('control: normal track has rail + support (the detector works)', { timeout: 240000 }, async ({ mc, state }) => {
    await startRide(mc);
    await mc.sprint(300); // let the builder open a healthy gap
    await mc.freeze();
    try {
      const head = await mc.score('.headX', 'ir');
      state.head0 = head;
      // A column safely behind the head but ahead of the pace cart.
      const probe = head - 12;
      const c = await columnBlocks(mc, probe);
      eq(c.rail, 'match', `rail present at normal column ${probe} (y ${c.y})`);
      eq(c.support, 'match', 'support present under it');
    } finally {
      await mc.unfreeze();
    }
  });

  test('toggle on: new columns carry NO rail/support but still get their light', { timeout: 300000 }, async ({ mc, state }) => {
    await mc.fn('mode_hidetrack_on');
    eq(await mc.score('.HIDETRACK', 'ir'), 1, '.HIDETRACK set');
    const onX = await mc.score('.headX', 'ir');
    state.onX = onX;
    await mc.sprint(600);
    await mc.freeze();
    try {
      eq(await mc.score('.stpAny', 'ir'), 1, 'the strip keeper armed (.stpAny)');
      const head = await mc.score('.headX', 'ir');
      ok(head > onX + 40, `head advanced while invisible (${onX} -> ${head}) - movement unchanged`);
      const cart = await mc.score('.cartX', 'ir');
      // Sample invisible columns well OUTSIDE the strip window (cart-2..cart+8).
      for (const probe of [Math.max(onX + 16, cart + 24), head - 12]) {
        const c = await columnBlocks(mc, probe);
        eq(c.rail, 'nomatch', `NO rail at invisible column ${probe} (y ${c.y})`);
        eq(c.support, 'nomatch', `NO support at invisible column ${probe}`);
        eq(c.light, 'match', `the track light still placed at invisible column ${probe}`);
      }
      // Track built BEFORE the toggle keeps its rails (its chunk may have
      // been released behind the ride by now -- load it for the check).
      // Deliberately NOT unloaded afterwards: forceload remove is not
      // refcounted, and this region can sit just AHEAD of the pace cart --
      // removing it punches a hole in the ride's own kept-loaded corridor,
      // freezing the cart there (a race this suite lost run-to-run; the
      // watchdog dutifully hop-rescued the cart through the hole, which is
      // exactly the false-positive noise the zero-rescue asserts exist to
      // catch). stopRide's forceload clear takes it back at suite end.
      const preX = state.head0 - 12;
      await mc.loadRegion(preX - 4, LINE_Z - 4, preX + 4, LINE_Z + 4, { settleMs: 800 });
      const c0 = await columnBlocks(mc, preX);
      eq(c0.rail, 'match', 'pre-toggle track keeps its rail');
    } finally {
      await mc.unfreeze();
    }
  });

  test('the just-in-time strip carries the pace cart across the invisible stretch', { timeout: 420000 }, async ({ mc, state }) => {
    // Run until the pace cart is well INSIDE the invisible segment.
    const t0 = Date.now();
    let cart = await mc.score('.cartX', 'ir');
    while (cart < state.onX + 24 && Date.now() - t0 < 300000) {
      await mc.sprint(400);
      cart = await mc.score('.cartX', 'ir');
    }
    ok(cart >= state.onX + 24, `pace cart entered the invisible stretch (${cart} vs toggle at ${state.onX})`);
    await mc.freeze();
    try {
      cart = await mc.score('.cartX', 'ir');
      // Ahead of the cart, inside the window: the strip's rails exist.
      const near = await columnBlocks(mc, cart + 4);
      eq(near.rail, 'match', `strip rail present just ahead of the cart (x ${cart + 4})`);
      eq(near.support, 'match', 'strip support present under it');
      // Beyond the window: nothing.
      const far = await columnBlocks(mc, cart + 24);
      eq(far.rail, 'nomatch', `no rail beyond the strip window (x ${cart + 24})`);
      // Behind the window: wiped again (still after the toggle point).
      const back = cart - 8;
      if (back > state.onX + 2) {
        const b = await columnBlocks(mc, back);
        eq(b.rail, 'nomatch', `strip rail wiped behind the cart (x ${back})`);
        eq(b.support, 'nomatch', `strip support wiped behind the cart (x ${back})`);
      }
      // The cart itself is healthy on the strip: it kept moving without a
      // single watchdog rescue (the movement-identical proof).
      eq(await mc.score('.wdfixn', 'ir'), 0, 'no watchdog rescues while riding the strip');
      const gap = await mc.score('.headX', 'ir') - cart;
      between(gap, 1, (await mc.score('.PACE_CART_BEHIND', 'cfg_ride')) + 32, 'build gap still sane');
    } finally {
      await mc.unfreeze();
    }
  });

  test('toggle off: new columns get rails again; the old stretch stays served', { timeout: 300000 }, async ({ mc, state }) => {
    await mc.fn('mode_hidetrack_off');
    eq(await mc.score('.HIDETRACK', 'ir'), 0, '.HIDETRACK cleared');
    const offX = await mc.score('.headX', 'ir');
    await mc.sprint(400);
    await mc.freeze();
    try {
      const head = await mc.score('.headX', 'ir');
      ok(head > offX + 16, `head advanced after toggle-off (${offX} -> ${head})`);
      const c = await columnBlocks(mc, Math.min(offX + 12, head - 4));
      eq(c.rail, 'match', 'post-toggle column has its rail back');
      eq(c.support, 'match', 'post-toggle column has its support back');
      eq(await mc.score('.wdfixn', 'ir'), 0, 'still no watchdog rescues');
    } finally {
      await mc.unfreeze();
    }
  });

  test('stop sweeps the serving strip and leaves the invisible stretch bare', { timeout: 120000 }, async ({ mc, state }) => {
    const cart = await mc.score('.cartX', 'ir');
    await stopRide(mc);
    await sleep(500);
    // The strip window around the cart's final position: wiped (only check
    // columns inside the invisible segment).
    await mc.loadRegion(cart - 8, LINE_Z - 8, cart + 12, LINE_Z + 8, { settleMs: 800 });
    let sweptChecked = 0;
    for (const probe of [cart + 2, cart + 6]) {
      if (probe > state.onX + 2) {
        const c = await columnBlocks(mc, probe);
        eq(c.rail, 'nomatch', `strip rail swept at x ${probe} after stop`);
        sweptChecked += 1;
      }
    }
    ok(sweptChecked > 0, 'at least one strip column verified swept');
    await mc.unloadRegion(cart - 8, LINE_Z - 8, cart + 12, LINE_Z + 8);
  });
});
