// The speed-scaled build budget (build_budget, .BUILD_FACTOR): the per-tick
// column budget must follow the ride's ACTIVE cruise -- ceil(speed x factor
// / 20), floored at 1, raised by the pace cart's measured motion -- so
// catch-up bursts cost a small multiple of what the ride consumes instead
// of the old flat worst-case cap.

import { defineSuite, eq } from '../lib/harness.mjs';
import { placeSurrogate, beginRide, awaitLaunched, stopRide } from '../lib/ride.mjs';

export default defineSuite('speed-scaled build budget', ({ test }) => {
  test('budget formula: contexts, factor, measured-motion term, floor', async ({ mc, expected }) => {
    const budgetWith = async (scores) => {
      // Deterministic inputs for one direct build_budget call.
      const defaults = {
        '.speed ir': 8, '.ocnspd ir': 32, '.skyspd ir': 18,
        '.fast ir': 0, '.SKYMODE ir': 0, '.mx ir': 0, '.BUILD_FACTOR cfg_ride': 3,
      };
      for (const [key, v] of Object.entries({ ...defaults, ...scores })) {
        const [holder, obj] = key.split(' ');
        await mc.setScore(holder, obj, v);
      }
      await mc.cmd('function infinite_rail:build_budget');
      return mc.score('.budget', 'ir');
    };

    eq(await budgetWith({}), 2, 'land speed 8 x3 -> ceil(24/20) = 2/tick');
    eq(await budgetWith({ '.speed ir': 32 }), 5, 'speed 32 x3 -> ceil(96/20) = 5/tick');
    eq(await budgetWith({ '.fast ir': 1 }), 5, 'ocean sprint uses .ocnspd (32 -> 5/tick)');
    eq(await budgetWith({ '.fast ir': 1, '.SKYMODE ir': 1 }), 3,
      'sky mode outranks the sprint, uses .skyspd (18 -> ceil(54/20) = 3/tick)');
    eq(await budgetWith({ '.BUILD_FACTOR cfg_ride': 10 }), 4, 'the factor scales it (8 x10 -> 4/tick)');
    eq(await budgetWith({ '.speed ir': 1, '.mx ir': 100 }), 3,
      'measured cart motion (1 block/tick) outranks a lower tracked speed');
    eq(await budgetWith({ '.speed ir': 0, '.mx ir': -50 }), 1,
      'floored at 1 (zeroed speed / backward-bounced cart still recovers)');

    // Leave the scoreboard as load made it: config restores the knobs, but
    // .speed/.ocnspd/.skyspd are STATE (seeded once by modes_init), and the
    // probes above overwrote them -- put the defaults back explicitly.
    await mc.cmd('function infinite_rail:config');
    await mc.setScore('.speed', 'ir', expected.get('.DEFAULTSPEED'));
    await mc.setScore('.ocnspd', 'ir', expected.get('.OCEANSPEED'));
    await mc.setScore('.skyspd', 'ir', expected.get('.SKYSPEED'));
    await mc.setScore('.fast', 'ir', 0);
    await mc.setScore('.SKYMODE', 'ir', 0);
    await mc.setScore('.mx', 'ir', 0);
  });

  test('live ride: a burst tick builds exactly the scaled budget', { timeout: 240000 }, async ({ mc, note }) => {
    await placeSurrogate(mc);
    // Determinism: no ocean sprint (the fixed seed is ocean-heavy), so the
    // cruise stays at the land speed 8 -> budget = ceil(8x3/20) = 2.
    await mc.cmd('scoreboard players set .OCEANSPEED cfg_ride 0');
    await beginRide(mc);
    await awaitLaunched(mc);

    // Open the gap condition so the budget is the only throttle, and kill
    // the pace cart so the measured-motion term reads 0: a cruising cart's
    // instantaneous Motion wobbles a hair above nominal (powered-rail
    // boost), which at high factors legitimately rounds the budget up by a
    // column -- correct behavior (covered by the formula test above), but
    // this leg wants exact tracked-speed numbers. Builds don't need the
    // cart (.cartX reads 0 and the opened gap condition still passes).
    await mc.cmd('scoreboard players set .PACE_CART_BEHIND cfg_ride 100000');
    await mc.cmd('kill @e[type=minecart,tag=ir_cart]');
    await mc.freeze();
    try {
      const h0 = await mc.score('.headX', 'ir');
      await mc.step(40, { timeoutMs: 120000 });
      const d1 = (await mc.score('.headX', 'ir')) - h0;
      eq(d1, 80, '40 stepped ticks x budget 2 = 80 columns at land speed 8, factor 3');

      await mc.cmd('scoreboard players set .BUILD_FACTOR cfg_ride 10');
      const h1 = await mc.score('.headX', 'ir');
      await mc.step(20, { timeoutMs: 120000 });
      const d2 = (await mc.score('.headX', 'ir')) - h1;
      eq(d2, 80, '20 stepped ticks x budget 4 = 80 columns at factor 10');
      note(`burst rate followed the knob: ${d1}/40 then ${d2}/20 columns per tick`);
    } finally {
      await mc.unfreeze();
      await mc.cmd('scoreboard players set .BUILD_FACTOR cfg_ride 3');
      await mc.cmd('scoreboard players set .PACE_CART_BEHIND cfg_ride 224');
    }
    await stopRide(mc);
  });
});
