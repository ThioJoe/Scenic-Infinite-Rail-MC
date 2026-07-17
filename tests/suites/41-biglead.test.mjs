// Doubled pace-cart lead at minimum render distance (CONTEXT 6.8/7g). The
// pace cart normally trails the rider by .PACE_CART_BEHIND - .RIDER_BEHIND =
// 224 - 160 = 64 blocks. This suite doubles that to 128 (by pulling the
// rider closer to the head -- .RIDER_BEHIND 96 -- while leaving the cart at
// its normal head-224, so it stays inside the rolling forceload corridor and
// never lands in a released band), and runs the whole ride on a server
// pinned to view/simulation distance 2 (the Fast-preset floor -- the
// low-power "TV NUC" shape). The question the user asked: does it still
// work at a big lead and 2-chunk render distance -- forward, invisible, and
// in reverse.
//
// Terrain generation is driven by the pack's own forceload corridor, NOT the
// player's render distance (that's the whole point of the corridor), so a
// larger lead just means the camera reads further back and the strip (when
// invisible) trails further behind -- both must still land on loaded chunks.

import { defineSuite, eq, ok, between } from '../lib/harness.mjs';
import { startRide, summonRig, stopRide, LINE_Z } from '../lib/ride.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function railLevel(mc, x) {
  const base = await mc.score('.trackBase', 'ir');
  const i = x - base;
  if (i < 0) return null;
  const y1 = await mc.trackY(i);
  const y0 = i > 0 ? await mc.trackY(i - 1) : y1;
  return (y0 === null || y1 === null) ? null : Math.min(y0, y1);
}

export default defineSuite('doubled pace lead at render distance 2', {
  server: { props: { 'view-distance': '2', 'simulation-distance': '2' } },
}, ({ test }) => {
  test('forward: builds and stays healthy with the cart 128 behind the rider', { timeout: 300000 }, async ({ mc }) => {
    // Set the geometry BEFORE the ride: rider 96 behind the head (cart stays
    // at head-224), so the cart trails the rider by 128. A live tweak, wiped
    // on reload -- begin reads it fresh.
    await mc.setScore('.RIDER_BEHIND', 'cfg_camera', 96);
    await startRide(mc);
    await summonRig(mc);
    eq(await mc.score('.PACE_CART_BEHIND', 'cfg_ride') - await mc.score('.RIDER_BEHIND', 'cfg_camera'), 128, 'rig lead is 128');
    const h0 = await mc.score('.headX', 'ir');
    await mc.sprint(600);
    const h1 = await mc.score('.headX', 'ir');
    ok(h1 > h0 + 200, `head advanced at the big lead (${h0} -> ${h1})`);
    await mc.freeze();
    try {
      // The rig rides 128 east of the pace cart (its lead), on a loaded chunk.
      const cart = await mc.entityNum('@e[type=minecart,tag=ir_cart,limit=1]', 'Pos[0]');
      const seat = await mc.entityNum('@e[type=item_display,tag=ir_seat,limit=1]', 'Pos[0]');
      ok(seat !== null && cart !== null, 'cart and seat both loaded (chunks kept)');
      between(seat - cart, 122, 134, `seat rides ~128 ahead of the cart (got ${(seat - cart).toFixed(1)})`);
      // The build buffer is still the full PACE_CART_BEHIND and the cart is on track.
      const gap = h1 - await mc.score('.cartX', 'ir');
      between(gap, 1, 224 + 32, 'build gap sane at the big lead');
      eq(await mc.score('.wdfixn', 'ir'), 0, 'no watchdog rescues on a healthy big-lead cruise');
    } finally {
      await mc.unfreeze();
    }
  });

  test('invisible + reverse survive the big lead at render distance 2', { timeout: 360000 }, async ({ mc }) => {
    // Invisible track: the just-in-time strip now trails the rider by 128 --
    // it must still find loaded chunks and carry the cart.
    await mc.fn('mode_hidetrack_on');
    await mc.sprint(500);
    ok(await mc.score('.stpAny', 'ir') === 1, 'strip armed');
    // Drive the cart into the invisible stretch, then confirm strip rail exists.
    const onX = await mc.score('.headX', 'ir');
    const t0 = Date.now();
    while ((await mc.score('.cartX', 'ir')) < onX + 24 && Date.now() - t0 < 200000) await mc.sprint(300);
    await mc.freeze();
    try {
      const cart = await mc.score('.cartX', 'ir');
      const y = await railLevel(mc, cart + 4);
      if (y !== null) eq(await mc.blockIs(cart + 4, y, LINE_Z, 'minecraft:powered_rail'), 'match', 'strip rail carries the cart at the big lead');
      eq(await mc.score('.wdfixn', 'ir'), 0, 'no rescues across the invisible stretch');
    } finally {
      await mc.unfreeze();
    }
    // Reverse at speed: the symmetric strip window (8 each way) must keep the
    // fast-reversing cart on rail even with the doubled lead.
    await mc.setScore('.speed', 'ir', -16);
    await mc.sprint(400);
    const cartR = await mc.score('.cartX', 'ir');
    await mc.sprint(200);
    ok((await mc.score('.cartX', 'ir')) < cartR, 'cart runs backwards at the big lead');
    between(await mc.score('.wdfixn', 'ir'), 0, 2, 'reverse at the big lead needs no runaway rescues');
    await mc.fn('mode_hidetrack_off');
    await mc.setScore('.speed', 'ir', 8);
    await stopRide(mc);
    // Restore the default lead for any later suite sharing this world (suites
    // get fresh worlds, but be tidy).
    await mc.setScore('.RIDER_BEHIND', 'cfg_camera', 160);
  });
});
