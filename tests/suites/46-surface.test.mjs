// Surface restoration (surf_note / surf_class / surf_fix): whatever ground
// the carve newly exposes beside the rails must be painted back into the
// surface material it was buried under -- grass-topped ground stays grass,
// snow-covered ground gets its snow layer back, and plain rock is left
// alone. Each scenario builds a controlled mound in blanked-out air and
// runs place_flat straight into it (no ride needed -- the carve is fully
// score-driven), then inspects the side stacks' newly exposed tops.
//
// The center cell is deliberately NOT asserted for restoration: its floor
// is always the support block, so only the two side stacks can end up as
// exposed dirt.

import { defineSuite, eq } from '../lib/harness.mjs';

// Blank a working volume to air, then build a mound spec inside it.
// Keeps each fill comfortably under the 32768-block command limit.
async function blankArea(mc, x, { y1 = 60, y2 = 140, r = 10 } = {}) {
  await mc.loadRegion(x - r - 2, -8, x + r + 2, 8, { settleMs: 1000 });
  for (let y = y1; y <= y2; y += 20) {
    await mc.cmd(`fill ${x - r} ${y} -6 ${x + r} ${Math.min(y2, y + 19)} 6 minecraft:air`);
  }
}

export default defineSuite('surface restoration after carving', ({ test }) => {
  test('grass-topped mound: exposed dirt beside the rails becomes grass', async ({ mc }) => {
    const x = 500;
    await blankArea(mc, x);
    // Dirt body with a grass skin, well wider than the 3-wide bore.
    await mc.cmd(`fill ${x - 5} 96 -3 ${x + 5} 103 3 minecraft:dirt`);
    await mc.cmd(`fill ${x - 5} 104 -3 ${x + 5} 104 3 minecraft:grass_block`);
    await mc.setScore('.veg', 'ir', 1);
    await mc.cmd(`execute positioned ${x} 100 0 run function infinite_rail:place_flat`);

    // The span (rail level 100 .. 106) had its first air at 105, so the
    // original surface was the grass at 104 -> the new tops at 99 (dirt
    // until now) must have turned to grass on BOTH sides.
    eq(await mc.blockIs(x, 99, -1, 'minecraft:grass_block'), 'match', 'left side new top painted to grass');
    eq(await mc.blockIs(x, 99, 1, 'minecraft:grass_block'), 'match', 'right side new top painted to grass');
    // The bore itself really was cleared, and the rail sits on its support.
    eq(await mc.blockIs(x, 101, -1, 'minecraft:air'), 'match', 'side stack cleared');
    eq(await mc.blockIs(x, 99, 0, 'minecraft:redstone_block'), 'match', 'center floor is the support block');
    eq(await mc.blockIs(x, 100, 0, 'minecraft:powered_rail'), 'match', 'rail placed');
    // Outside the 3-wide bore nothing was painted or cleared.
    eq(await mc.blockIs(x, 104, 2, 'minecraft:grass_block'), 'match', 'ground beyond the bore untouched');
    eq(await mc.blockIs(x, 99, 2, 'minecraft:dirt'), 'match', 'buried dirt beyond the bore untouched');
  });

  test('snow-covered mound: new ground turns grass AND gets its snow layer back', async ({ mc }) => {
    const x = 560;
    await blankArea(mc, x);
    await mc.cmd(`fill ${x - 5} 96 -3 ${x + 5} 103 3 minecraft:dirt`);
    await mc.cmd(`fill ${x - 5} 104 -3 ${x + 5} 104 3 minecraft:grass_block`);
    await mc.cmd(`fill ${x - 5} 105 -3 ${x + 5} 105 3 minecraft:snow`);
    await mc.setScore('.veg', 'ir', 1);
    await mc.cmd(`execute positioned ${x} 100 0 run function infinite_rail:place_flat`);

    // First air of the span at 106, surface = the snow layer at 105
    // (class 5): the new top gets grass AND a fresh snow layer on it.
    eq(await mc.blockIs(x, 99, -1, 'minecraft:grass_block'), 'match', 'left side new top painted to grass');
    eq(await mc.blockIs(x, 100, -1, 'minecraft:snow'), 'match', 'left side got its snow layer back');
    eq(await mc.blockIs(x, 99, 1, 'minecraft:grass_block'), 'match', 'right side new top painted to grass');
    eq(await mc.blockIs(x, 100, 1, 'minecraft:snow'), 'match', 'right side got its snow layer back');
  });

  test('buried span (no air): the top cleared block stands in as the surface', async ({ mc }) => {
    const x = 620;
    await blankArea(mc, x);
    // A solid face -- the whole span 100..106 is dirt, no air anywhere --
    // but its TOP cells are grass: the tunnel grazes just under a meadow.
    await mc.cmd(`fill ${x - 5} 96 -3 ${x + 5} 112 3 minecraft:dirt`);
    await mc.cmd(`fill ${x} 106 -1 ${x} 106 1 minecraft:grass_block`);
    await mc.setScore('.veg', 'ir', 1);
    await mc.cmd(`execute positioned ${x} 100 0 run function infinite_rail:place_flat`);

    eq(await mc.blockIs(x, 99, -1, 'minecraft:grass_block'), 'match', 'left side new top painted to grass (no-air fallback)');
    eq(await mc.blockIs(x, 99, 1, 'minecraft:grass_block'), 'match', 'right side new top painted to grass (no-air fallback)');
    eq(await mc.blockIs(x, 107, -1, 'minecraft:dirt'), 'match', 'tunnel ceiling untouched');
  });

  test('deep rock tunnel: nothing is painted (class 0 leaves stone alone)', async ({ mc }) => {
    const x = 680;
    await blankArea(mc, x);
    await mc.cmd(`fill ${x - 5} 90 -3 ${x + 5} 112 3 minecraft:stone`);
    await mc.setScore('.veg', 'ir', 1);
    await mc.cmd(`execute positioned ${x} 100 0 run function infinite_rail:place_flat`);

    eq(await mc.blockIs(x, 99, -1, 'minecraft:stone'), 'match', 'left side new top stays stone');
    eq(await mc.blockIs(x, 99, 1, 'minecraft:stone'), 'match', 'right side new top stays stone');
    eq(await mc.blockIs(x, 101, -1, 'minecraft:air'), 'match', 'side stack still cleared');
  });

  test('open ground: air at the bottom of the span means no repaint', async ({ mc }) => {
    const x = 740;
    await blankArea(mc, x);
    // Ground BELOW rail level, dirt-topped: the span is all air, nothing
    // gets cleared below the airline, so the exposed dirt at 97 must NOT
    // be grassed over (class 0 -- it was exposed before the carve too).
    await mc.cmd(`fill ${x - 5} 90 -3 ${x + 5} 97 3 minecraft:dirt`);
    await mc.setScore('.veg', 'ir', 1);
    await mc.cmd(`execute positioned ${x} 100 0 run function infinite_rail:place_flat`);

    eq(await mc.blockIs(x, 97, -1, 'minecraft:dirt'), 'match', 'already-exposed dirt left alone');
    eq(await mc.blockIs(x, 97, 1, 'minecraft:dirt'), 'match', 'already-exposed dirt left alone');
  });

  test('no unexpected server errors', async ({ mc, server }) => {
    await mc.cmd('kill @e[type=block_display,tag=ir_disp]');
    const errs = server.errorsSince(0, { alsoIgnore: [/Failed to load function/] });
    eq(errs.length, 0, `unexpected ERROR lines: ${errs.slice(0, 5).join(' | ')}`);
  });
});
