// Vegetation AND man-made structure blocks must be invisible to the slope
// logic: the surface probe digs down through #infinite_rail:not_terrain
// (which nests #infinite_rail:keep -- logs, leaves, ... -- and adds planks,
// stairs, wool, glass and the other structure blocks), so forests and
// village houses read as the ground they stand on. If that dig-down ever
// regressed, .gmax / the sample average would read the canopy or roof line
// and the line would climb over it as if it were a hill (the "the climb is
// not ignoring vegetation/structures" symptom). This suite builds two dense
// walls across the line's path ahead of the build head -- one of logs, one
// of planks, each far too wide for the near scan's pair-min to erase -- and
// asserts the profile stays at ground level straight through both.

import { defineSuite, ok } from '../lib/harness.mjs';
import { startRide, stopRide, LINE_Z } from '../lib/ride.mjs';

export default defineSuite('vegetation & structures invisible to slope logic', ({ test }) => {
  test('tall log + planks walls ahead do not make the line climb', { timeout: 300000 }, async ({ mc, note }) => {
    await startRide(mc);
    await mc.freeze();
    let wallX;
    let base;
    try {
      const headX = await mc.score('.headX', 'ir');
      const railY = await mc.score('.railY', 'ir');
      base = await mc.score('.trackBase', 'ir');
      // Ahead of everything the head has sampled so far (the window reaches
      // .SAMPLE_WINDOW past the head), so every column through the walls is
      // decided with them already standing.
      wallX = headX + 96;
      await mc.loadRegion(wallX - 8, LINE_Z - 8, wallX + 60, LINE_Z + 8, { settleMs: 1200 });
      // Two solid barriers: 8 columns deep, full track width, ~22 blocks
      // above the rail line (embedded a few blocks down so they are seated
      // on the ground whatever the local surface is). jungle_wood is in
      // #minecraft:logs -> #infinite_rail:keep; oak_planks is in
      // #minecraft:planks -- both nested by #infinite_rail:not_terrain.
      await mc.cmd(`fill ${wallX} ${railY - 4} ${LINE_Z - 4} ${wallX + 7} ${railY + 22} ${LINE_Z + 4} minecraft:jungle_wood`);
      await mc.cmd(`fill ${wallX + 36} ${railY - 4} ${LINE_Z - 4} ${wallX + 43} ${railY + 22} ${LINE_Z + 4} minecraft:oak_planks`);
    } finally {
      await mc.unfreeze();
    }

    // Let the ride decide and build through both wall regions.
    for (let i = 0; i < 5 && (await mc.score('.headX', 'ir')) < wallX + 70; i++) {
      await mc.sprint(400, { timeoutMs: 120000 });
    }
    ok((await mc.score('.headX', 'ir')) >= wallX + 70, 'head built past both walls');

    await mc.freeze();
    try {
      // The approach level vs the wall zones: if a wall read as terrain the
      // line would ramp up ~20+ blocks for it; ground-level noise from the
      // seed's own terrain stays well under the +8 tolerance.
      let approachMax = -10000;
      for (let x = wallX - 30; x < wallX; x++) {
        approachMax = Math.max(approachMax, await mc.trackY(x - base));
      }
      let logMax = -10000;
      for (let x = wallX; x <= wallX + 15; x++) {
        logMax = Math.max(logMax, await mc.trackY(x - base));
      }
      let plankMax = -10000;
      for (let x = wallX + 36; x <= wallX + 55; x++) {
        plankMax = Math.max(plankMax, await mc.trackY(x - base));
      }
      note(`approach max Y ${approachMax}, log-wall zone max Y ${logMax}, planks-wall zone max Y ${plankMax}`);
      ok(logMax <= approachMax + 8,
        `line climbed over the LOG wall (zone Y ${logMax} vs approach Y ${approachMax}) -- the probe is reading vegetation as ground`);
      ok(plankMax <= approachMax + 8,
        `line climbed over the PLANKS wall (zone Y ${plankMax} vs approach Y ${approachMax}) -- the probe is reading structure blocks as ground`);
    } finally {
      await mc.unfreeze();
    }
    await stopRide(mc);
  });
});
