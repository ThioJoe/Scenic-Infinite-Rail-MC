// The smooth-stone disguise displays (block_display, tag ir_disp on real
// track; ir_strip on the invisible-track pace strip) -- two regressions the
// user hit reversing on Java:
//
//  1. The strip displays rendered half a block south-east of their redstone.
//     Cause: /summon with BARE integer X/Z block-centers them (+0.5); the
//     macro's `$(x) $(sy) $(z)` therefore landed at the block CENTRE, while
//     the regular support display (align xyz + relative `~`) lands at the
//     block CORNER. Fix: the strip summon carries explicit ".0" coords.
//
//  2. The permanent track's ir_disp displays turned back into bare red
//     redstone ~256 blocks behind the head -- the roll_chunks passed-entity
//     cull (type=!player) was killing them. Fix: the cull excludes the
//     ride's own entity kinds, so displays ride out with their released
//     chunk and reload disguised on a revisit (the reverse case).

import { defineSuite, eq, ok, closeTo, between } from '../lib/harness.mjs';
import { startRide, stopRide, LINE_Z } from '../lib/ride.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frac = (v) => Math.abs(v - Math.round(v));

export default defineSuite('disguise displays (alignment + cull)', ({ test }) => {
  test('summon centering trap: bare integer coords land at the block CENTRE, ".0" at the CORNER', async ({ mc }) => {
    // The lesson, isolated: this is why the strip needs ".0". A block_display
    // must sit on the CORNER (like the redstone block it hides).
    const X = 2100, Z = 2100;
    await mc.loadRegion(X - 4, Z - 4, X + 4, Z + 4, { settleMs: 1000 });
    await mc.cmd('kill @e[type=block_display,tag=ir_diag]');
    await mc.cmd(`summon minecraft:block_display ${X} 100 ${Z} {Tags:["ir_diag","ir_diag_bare"]}`);
    await mc.cmd(`summon minecraft:block_display ${X}.0 100 ${Z}.0 {Tags:["ir_diag","ir_diag_dot0"]}`);
    await sleep(1200);
    const bareZ = await mc.entityNum('@e[tag=ir_diag_bare,limit=1]', 'Pos[2]');
    const dot0Z = await mc.entityNum('@e[tag=ir_diag_dot0,limit=1]', 'Pos[2]');
    closeTo(bareZ, Z + 0.5, 0.01, 'bare integer summon block-centers Z (+0.5) -- the trap');
    closeTo(dot0Z, Z, 0.01, '".0" summon lands on the block corner');
    await mc.cmd('kill @e[type=block_display,tag=ir_diag]');
    await mc.unloadRegion(X - 4, Z - 4, X + 4, Z + 4);
  });

  test('strip display is corner-aligned with its redstone (not the +0.5 offset)', { timeout: 300000 }, async ({ mc }) => {
    await startRide(mc);
    await mc.fn('mode_hidetrack_on');
    // Run until the pace cart is inside the invisible stretch and the strip
    // is placing displays.
    const onX = await mc.score('.headX', 'ir');
    const t0 = Date.now();
    while ((await mc.score('.cartX', 'ir')) < onX + 20 && Date.now() - t0 < 200000) await mc.sprint(300);
    await mc.freeze();
    try {
      ok(await mc.entityExists('@e[type=block_display,tag=ir_strip,limit=1]'), 'strip displays exist');
      const lineZ = await mc.score('.lineZ', 'ir');
      const dz = await mc.entityNum('@e[type=block_display,tag=ir_strip,limit=1]', 'Pos[2]');
      const dx = await mc.entityNum('@e[type=block_display,tag=ir_strip,limit=1]', 'Pos[0]');
      // Corner: Z equals the (integer) centreline exactly, X is integer --
      // NOT centreZ+0.5 / X+0.5 as the bare-integer summon produced.
      closeTo(dz, lineZ, 0.01, 'strip display Z on the block corner (== .lineZ, not +0.5 south)');
      closeTo(frac(dx), 0, 0.01, 'strip display X on the block corner (integer)');
    } finally {
      await mc.unfreeze();
    }
    await mc.fn('mode_hidetrack_off');
    await stopRide(mc);
  });

  test('the roll cull spares track displays (they survive release + reload)', { timeout: 300000 }, async ({ mc }) => {
    const { trackBase } = await startRide(mc);
    // Sprint until the head is far enough that an early section has passed
    // fully through the release band (~256-336 behind the head) and been
    // forceload-released -- the moment the cull would have run on it.
    const t0 = Date.now();
    while ((await mc.score('.headX', 'ir')) < trackBase + 450 && Date.now() - t0 < 200000) await mc.sprint(400);
    ok((await mc.score('.headX', 'ir')) >= trackBase + 450, 'head advanced well past the early section');
    // Reload an early band (well behind the head, long since released) and
    // check its disguise displays are still there. With the cull sparing
    // them they reload with the chunk; the old type=!player cull left zero
    // (bare redstone -- what the user saw reversing).
    const x1 = trackBase + 20, x2 = trackBase + 70;
    await mc.loadRegion(x1 - 2, LINE_Z - 2, x2 + 2, LINE_Z + 2, { settleMs: 1500 });
    await sleep(1000);
    const present = await mc.entityExists(`@e[type=block_display,tag=ir_disp,x=${x1},dx=${x2 - x1},y=-64,dy=384,z=${LINE_Z - 2},dz=4,limit=1]`);
    ok(present, 'disguise displays present on released-then-reloaded track (cull spared them)');
    // And they are still corner-aligned with their redstone (spot one).
    const dz = await mc.entityNum(`@e[type=block_display,tag=ir_disp,x=${x1},dx=${x2 - x1},y=-64,dy=384,z=${LINE_Z - 2},dz=4,limit=1]`, 'Pos[2]');
    if (dz !== null) closeTo(dz, LINE_Z, 0.01, 'reloaded display still corner-aligned on the centreline');
    await mc.unloadRegion(x1 - 2, LINE_Z - 2, x2 + 2, LINE_Z + 2);
    await stopRide(mc);
  });
});
