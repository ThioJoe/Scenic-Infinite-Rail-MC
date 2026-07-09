// The adjustable ride-speed state machine (shared speed_step + the Java
// entry points): stepping, the floor, the grid-rejoin quirk, reset, and
// whether speed_apply really lands in the minecart max-speed gamerule.

import { defineSuite, eq, ok, skip } from '../lib/harness.mjs';

async function speedRule(mc) {
  const rule = await mc.storageString('infinite_rail:speed', 'rule');
  const r = await mc.cmd(`gamerule ${rule}`);
  const m = r.match(/currently set to: (-?\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

export default defineSuite('ride speed state machine', ({ test }) => {
  test('fresh world: .speed equals the config default', async ({ mc, expected }) => {
    eq(await mc.score('.speed', 'ir'), expected.get('.MAXSPEED'), '.speed');
  });

  test('Speed + adds one .SPEEDSTEP', async ({ mc, expected }) => {
    const step = await mc.score('.SPEEDSTEP', 'ir');
    eq(step, 4, '.SPEEDSTEP cross-edition constant');
    await mc.fn('speed_inc');
    eq(await mc.score('.speed', 'ir'), expected.get('.MAXSPEED') + step, 'after one Speed + click');
    eq(await mc.score('.spdflt', 'ir'), 0, 'no longer the default');
  });

  test('Speed - subtracts one .SPEEDSTEP', async ({ mc, expected }) => {
    await mc.fn('speed_dec');
    eq(await mc.score('.speed', 'ir'), expected.get('.MAXSPEED'), 'back to default');
    eq(await mc.score('.spdflt', 'ir'), 1, 'reported as default again');
  });

  test('speed floors at 1 and never goes below', async ({ mc }) => {
    // From the default 8: dec -> 4, dec -> 0 -> floored to 1, dec -> stays 1.
    await mc.fn('speed_dec');
    eq(await mc.score('.speed', 'ir'), 4, '8 - 4');
    await mc.fn('speed_dec');
    eq(await mc.score('.speed', 'ir'), 1, '4 - 4 clamps to the floor of 1');
    await mc.fn('speed_dec');
    eq(await mc.score('.speed', 'ir'), 1, 'clicking - at the floor stays at 1');
  });

  test('Speed + from the floor rejoins the 4-grid at 4 (not 5)', async ({ mc }) => {
    eq(await mc.score('.speed', 'ir'), 1, 'precondition: at the floor');
    await mc.fn('speed_inc');
    eq(await mc.score('.speed', 'ir'), 4, 'floor + one step lands ON the grid');
  });

  test('reset returns to the config default', async ({ mc, expected }) => {
    await mc.fn('speed_inc');
    await mc.fn('speed_inc');
    await mc.fn('speed_reset');
    eq(await mc.score('.speed', 'ir'), expected.get('.MAXSPEED'), 'after [Reset]');
    eq(await mc.score('.spdflt', 'ir'), 1, '.spdflt answers default');
  });

  test('speed_apply pushes .speed into the max-speed gamerule', async ({ mc }) => {
    if (await speedRule(mc) === null) skip('minecart max-speed gamerule missing on this server (see version-compat suite)');
    await mc.setScore('.fast', 'ir', 0);
    await mc.fn('speed_inc'); // 12, applies
    eq(await speedRule(mc), 12, 'gamerule follows the Speed + click');
    await mc.fn('speed_reset');
    eq(await speedRule(mc), 8, 'gamerule follows reset');
  });

  test('ocean speed_up applies the ocean cruise (.ocnspd) and flags .fast', async ({ mc, expected }) => {
    await mc.setScore('.fast', 'ir', 0);
    await mc.fn('speed_up');
    const ocean = expected.get('.OCEANSPEED');
    eq(await mc.score('.ocnspd', 'ir'), ocean, '.ocnspd seeded from the config default');
    eq(await mc.score('.fast', 'ir'), 1, '.fast raised');
    const rule = await speedRule(mc);
    if (rule !== null) eq(rule, ocean, 'gamerule got the ocean cruise');
  });

  test('Speed items tune the ocean cruise while the sprint is on -- both directions', async ({ mc, expected }) => {
    const ocean = expected.get('.OCEANSPEED');
    const land = await mc.score('.speed', 'ir');
    // .fast is still 1 from the previous test's speed_up.
    await mc.fn('speed_inc');
    eq(await mc.score('.ocnspd', 'ir'), ocean + 4, 'Speed + steps the ocean cruise up');
    eq(await mc.score('.speed', 'ir'), land, 'the land speed is untouched');
    const rule = await speedRule(mc);
    if (rule !== null) eq(rule, ocean + 4, 'the click applies immediately (no more deferral)');
    await mc.fn('speed_dec');
    await mc.fn('speed_dec');
    eq(await mc.score('.ocnspd', 'ir'), ocean - 4, 'Speed - goes BELOW the ocean default (the old max() rule is gone)');
    await mc.fn('speed_reset');
    eq(await mc.score('.ocnspd', 'ir'), ocean, 'Reset returns the ocean cruise to .OCEANSPEED');
    eq(await mc.score('.spdflt', 'ir'), 1, '.spdflt answers the ocean default');
  });

  test('speed_down restores the land speed and clears .fast', async ({ mc, expected }) => {
    await mc.fn('speed_down');
    eq(await mc.score('.fast', 'ir'), 0, '.fast cleared');
    const rule = await speedRule(mc);
    if (rule !== null) eq(rule, expected.get('.MAXSPEED'), 'gamerule back to the land speed');
  });

  test('sky mode: Speed +/- and Reset tune the sky cruise (.skyspd), not the land speed', async ({ mc, expected }) => {
    const land = await mc.score('.speed', 'ir');
    const skyDefault = expected.get('.SKYSPEED');
    await mc.setScore('.SKYMODE', 'ir', 1);
    await mc.fn('speed_inc');
    eq(await mc.score('.skyspd', 'ir'), skyDefault + 4, 'sky cruise steps up by one .SPEEDSTEP');
    eq(await mc.score('.speed', 'ir'), land, 'the land speed is untouched while sky mode owns the ride');
    eq(await mc.score('.spdflt', 'ir'), 0, 'no longer the sky default');
    await mc.fn('speed_reset');
    eq(await mc.score('.skyspd', 'ir'), skyDefault, 'Reset returns the sky cruise to the config .SKYSPEED');
    eq(await mc.score('.spdflt', 'ir'), 1, '.spdflt answers the sky default');
    await mc.setScore('.SKYMODE', 'ir', 0);
  });
});
