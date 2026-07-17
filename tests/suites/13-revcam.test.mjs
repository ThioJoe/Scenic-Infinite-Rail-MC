// The smooth camera on the Java engine, forward vs reverse (CONTEXT 7g).
// The user reported that reversing back up a descent followed a MUCH lower
// path than the forward descent -- sinking into the track to the point of
// the suffocation sound -- while ascents were symmetric. The camera height
// is now a STATELESS function of position (the symmetric lifted() max, with
// the old reactive descent chaser removed), so the two directions must
// retrace the exact same path. tests/simulate.mjs proves that on the shared
// cam_math.js; this proves the Java fixed-point cam_follow behaves the same
// on the real engine.
//
// Setup is synthetic and self-contained (no ride): a hand-written descent
// profile in the track history, the rig lead pinned to 0 (so the camera
// samples the profile right at the pace cart's column), and the pace cart
// teleported column by column -- forward, then reverse -- while cam_follow
// flies the seat and we read its Y. Frozen throughout, so nothing drifts.

import { defineSuite, eq, ok, between } from '../lib/harness.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// flat top (100) x10, a 10-block descent (99..90), flat bottom (90) x10.
const H = [];
for (let i = 0; i < 10; i++) H.push(100);
for (let i = 0; i < 10; i++) H.push(99 - i);
for (let i = 0; i < 10; i++) H.push(90);
const BASE = 3000; // world X of history index 0
const Z = 3000;

export default defineSuite('smooth camera forward == reverse (Java)', ({ test }) => {
  test('reverse retraces the forward descent path (no sinking)', { timeout: 180000 }, async ({ mc }) => {
    // Rig lead 0: cam_follow samples the profile at the cart's own column.
    await mc.setScore('.PACE_CART_BEHIND', 'cfg_ride', 0);
    await mc.setScore('.RIDER_BEHIND', 'cfg_camera', 0);
    await mc.setScore('.CAMHEIGHT', 'cfg_camera', 0);
    await mc.setScore('.trackBase', 'ir', BASE);
    await mc.setScore('.headX', 'ir', BASE + H.length - 1);
    await mc.setScore('.lineZ', 'ir', Z);
    await mc.cmd(`data modify storage infinite_rail:track y set value [${H.join(',')}]`);

    await mc.loadRegion(BASE - 4, Z - 4, BASE + H.length + 4, Z + 4, { settleMs: 1200 });
    await mc.cmd(`summon minecraft:minecart ${BASE}.0 120 ${Z}.0 {Tags:["ir_cart"],Invulnerable:1b,NoGravity:1b,Motion:[0.0,0.0,0.0]}`);
    await mc.cmd(`summon minecraft:item_display ${BASE}.0 120 ${Z}.0 {Tags:["ir_seat"],teleport_duration:1}`);
    if (!await mc.entityExists('@e[type=minecart,tag=ir_cart,limit=1]')) return ok('cart could not spawn (chunk not ready) -- skipping');

    await mc.freeze();
    const sample = async () => {
      const map = {};
      for (let idx = 0; idx < H.length; idx++) {
        await mc.cmd(`tp @e[type=minecart,tag=ir_cart,limit=1] ${BASE + idx}.0 120 ${Z}.0 0 0`);
        await mc.cmd('data merge entity @e[type=minecart,tag=ir_cart,limit=1] {Motion:[0.0,0.0,0.0]}');
        await mc.fn('cam_follow');
        map[idx] = await mc.entityNum('@e[type=item_display,tag=ir_seat,limit=1]', 'Pos[1]');
      }
      return map;
    };
    try {
      const fwd = await sample();
      // Reverse: same columns, opposite order. If any hidden state remained
      // in the height (the old chaser), the two passes would differ here.
      const rev = {};
      for (let idx = H.length - 1; idx >= 0; idx--) {
        await mc.cmd(`tp @e[type=minecart,tag=ir_cart,limit=1] ${BASE + idx}.0 120 ${Z}.0 0 0`);
        await mc.cmd('data merge entity @e[type=minecart,tag=ir_cart,limit=1] {Motion:[0.0,0.0,0.0]}');
        await mc.fn('cam_follow');
        rev[idx] = await mc.entityNum('@e[type=item_display,tag=ir_seat,limit=1]', 'Pos[1]');
      }

      let maxDiff = 0;
      for (let idx = 0; idx < H.length; idx++) {
        if (fwd[idx] == null || rev[idx] == null) return ok(`seat Y unreadable at idx ${idx} (chunk) -- skipping asserts`);
        maxDiff = Math.max(maxDiff, Math.abs(fwd[idx] - rev[idx]));
      }
      ok(`max |forward - reverse| seat Y = ${maxDiff.toFixed(4)} blocks`);
      if (maxDiff > 0.01) return eq(maxDiff < 0.01, true, `camera path must be direction-symmetric (got ${maxDiff.toFixed(3)} blocks of drift)`);

      // Never below the rail line, and NOT hugging it on the descent: the
      // camera floats ~.CAMLIFT (2 blocks) above the line mid-descent, both
      // directions (the discriminator -- the buggy reverse hugged the rail).
      const seatFloat = (idx) => fwd[idx] - H[idx]; // seat Y is ~railLine + 62/1000 + float
      for (let idx = 0; idx < H.length; idx++) {
        if (fwd[idx] < H[idx] - 0.01) return eq(fwd[idx] >= H[idx], true, `seat sank below the rail line at idx ${idx} (${fwd[idx]} < ${H[idx]})`);
      }
      // Deep flat top: rides the line (float ~= 0.06).
      between(seatFloat(3), 0, 0.4, 'level on the flat top (rides the rail line)');
      // Mid-descent: floats ~2 blocks above the line (NOT hugging it).
      for (const idx of [13, 15, 17]) {
        between(seatFloat(idx), 1.4, 2.7, `mid-descent floats ~CAMLIFT above the line at idx ${idx} (float ${seatFloat(idx).toFixed(2)})`);
      }
    } finally {
      await mc.unfreeze();
      await mc.cmd('kill @e[type=minecart,tag=ir_cart]');
      await mc.cmd('kill @e[type=item_display,tag=ir_seat]');
      await mc.unloadRegion(BASE - 4, Z - 4, BASE + H.length + 4, Z + 4);
    }
  });
});
