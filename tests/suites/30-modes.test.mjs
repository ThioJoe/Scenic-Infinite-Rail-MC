// Ride modes: every toggle flips its state score, the tri-states hit all
// their values, the density presets set what the roll actually reads, the
// time modes really move the world clock, and sky mode steers the rail to
// .SKYY through the ordinary event model (a real climbing ride).

import { defineSuite, eq, ok } from '../lib/harness.mjs';
import { startRide, stopRide } from '../lib/ride.mjs';

export default defineSuite('ride modes', ({ test }) => {
  test('torch tri-state: on / off / auto', async ({ mc }) => {
    await mc.fn('mode_torches_on');
    eq(await mc.score('.TORCHMODE', 'ir'), 1, 'on');
    await mc.fn('mode_torches_off');
    eq(await mc.score('.TORCHMODE', 'ir'), 0, 'off');
    await mc.fn('mode_torches_auto');
    eq(await mc.score('.TORCHMODE', 'ir'), 2, 'auto (default)');
  });

  test('torch density presets set .torchdens (the roll input)', async ({ mc, expected }) => {
    const presets = [['torch_density_low', 15], ['torch_density_medium', 35], ['torch_density_high', 70], ['torch_density_max', 100]];
    for (const [fn, val] of presets) {
      await mc.fn(fn);
      eq(await mc.score('.torchdens', 'ir'), val, fn);
    }
    // put the seed default back so later suites see pristine state
    await mc.setScore('.torchdens', 'ir', expected.get('.TORCHODDS'));
  });

  test('time tri-state moves the world clock (night / day / default)', async ({ mc }) => {
    await mc.fn('mode_night_on');
    eq(await mc.score('.NIGHTMODE', 'ir'), 1, 'night mode score');
    await mc.fn('time_now');
    eq(await mc.score('.tod', 'ir'), 18000, 'world clock parked in the night window');

    await mc.fn('mode_day_on');
    eq(await mc.score('.NIGHTMODE', 'ir'), 2, 'day mode score');
    await mc.fn('time_now');
    eq(await mc.score('.tod', 'ir'), 6000, 'world clock parked at noon');

    await mc.fn('mode_night_off');
    eq(await mc.score('.NIGHTMODE', 'ir'), 0, 'back to the default cycle');
  });

  test('rain mode flips .RAINMODE', async ({ mc }) => {
    await mc.fn('mode_rain_on');
    eq(await mc.score('.RAINMODE', 'ir'), 1, 'rain on');
    await mc.fn('mode_rain_off');
    eq(await mc.score('.RAINMODE', 'ir'), 0, 'rain off');
  });

  test('cart sound / hide-cart / mobs-aggro toggles', async ({ mc }) => {
    await mc.fn('mode_sound_off');
    eq(await mc.score('.SOUNDMODE', 'ir'), 0, 'sound off');
    await mc.fn('mode_sound_on');
    eq(await mc.score('.SOUNDMODE', 'ir'), 1, 'sound on');
    await mc.fn('mode_hidecart_on');
    eq(await mc.score('.HIDECART', 'ir'), 1, 'hide-cart on');
    await mc.fn('mode_hidecart_off');
    eq(await mc.score('.HIDECART', 'ir'), 0, 'hide-cart off');
    await mc.fn('mode_aggro_off');
    eq(await mc.score('.AGGROMODE', 'ir'), 0, 'aggro off');
    await mc.fn('mode_aggro_on');
    eq(await mc.score('.AGGROMODE', 'ir'), 1, 'aggro on (default)');
  });

  test('sky mode: rail climbs to exactly .SKYY and holds level', { timeout: 300000 }, async ({ mc, note }) => {
    const { railY0 } = await startRide(mc);
    // Aim above wherever the terrain anchored us so a real climb must happen.
    const target = Math.max(railY0 + 25, await mc.score('.SKYY', 'cfg_ride'));
    await mc.setScore('.SKYY', 'cfg_ride', target);
    await mc.fn('mode_sky_on');
    eq(await mc.score('.SKYMODE', 'ir'), 1, 'sky mode score');

    await mc.sprint(500, { timeoutMs: 180000 });
    const railY = await mc.score('.railY', 'ir');
    note(`anchored at Y ${railY0}, sky target ${target}, railY now ${railY}`);
    eq(railY, target, 'rail reached the sky cruising altitude exactly');
    const len = await mc.trackLen();
    eq(await mc.trackY(len - 1), target, 'newest column holds the altitude');
    eq(await mc.trackY(len - 2), target, 'held level, not oscillating');

    await mc.fn('mode_sky_off');
    eq(await mc.score('.SKYMODE', 'ir'), 0, 'sky mode off');
    await mc.sprint(400, { timeoutMs: 180000 });
    const after = await mc.score('.railY', 'ir');
    note(`after sky off: railY ${after}`);
    ok(after < target - 5, `rail glides back down toward the terrain (still at ${after}, target was ${target})`);
    await stopRide(mc);
  });
});
