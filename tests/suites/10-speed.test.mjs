// The adjustable ride-speed state machine (shared speed_step + the Java
// entry points): stepping, the floor, the selectable-speed grid (fine by 1
// below 8, coarse by .SPEEDSTEP from 8 up), reset, and whether speed_apply
// really lands in the minecart max-speed gamerule.

import { defineSuite, eq, ok, skip } from '../lib/harness.mjs';

async function speedRule(mc) {
  const rule = await mc.storageString('infinite_rail:speed', 'rule');
  const r = await mc.cmd(`gamerule ${rule}`);
  const m = r.match(/currently set to: (-?\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

export default defineSuite('ride speed state machine', ({ test }) => {
  test('fresh world: .speed equals the config default', async ({ mc, expected }) => {
    eq(await mc.score('.speed', 'ir'), expected.get('.DEFAULTSPEED'), '.speed');
  });

  test('Speed + adds one .SPEEDSTEP', async ({ mc, expected }) => {
    const step = await mc.score('.SPEEDSTEP', 'ir');
    eq(step, 4, '.SPEEDSTEP cross-edition constant');
    await mc.fn('speed_inc');
    eq(await mc.score('.speed', 'ir'), expected.get('.DEFAULTSPEED') + step, 'after one Speed + click');
    eq(await mc.score('.spdflt', 'ir'), 0, 'no longer the default');
  });

  test('Speed - subtracts one .SPEEDSTEP', async ({ mc, expected }) => {
    await mc.fn('speed_dec');
    eq(await mc.score('.speed', 'ir'), expected.get('.DEFAULTSPEED'), 'back to default');
    eq(await mc.score('.spdflt', 'ir'), 1, 'reported as default again');
  });

  test('Speed - walks the sub-8 grid down to the floor of 1', async ({ mc }) => {
    // From the default 8, one notch at a time down the selectable grid:
    // 8 -> 6 (bridge into the fine zone) -> 5 -> 4 -> 3 -> 2 -> 1, then it
    // stays at 1 no matter how many more times you click.
    await mc.fn('speed_dec');
    eq(await mc.score('.speed', 'ir'), 6, '8 - one notch = 6 (grid bridges 8<->6)');
    for (const want of [5, 4, 3, 2, 1]) {
      await mc.fn('speed_dec');
      eq(await mc.score('.speed', 'ir'), want, `down one to ${want}`);
    }
    await mc.fn('speed_dec');
    eq(await mc.score('.speed', 'ir'), 1, 'clicking - at the floor stays at 1');
  });

  test('Speed + walks the sub-8 grid up: 1,2,3,4,5,6,8 (no 7), then +.SPEEDSTEP', async ({ mc }) => {
    eq(await mc.score('.speed', 'ir'), 1, 'precondition: at the floor');
    for (const want of [2, 3, 4, 5, 6]) {
      await mc.fn('speed_inc');
      eq(await mc.score('.speed', 'ir'), want, `up one to ${want}`);
    }
    await mc.fn('speed_inc');
    eq(await mc.score('.speed', 'ir'), 8, '6 -> 8 (grid skips 7 into the coarse zone)');
    await mc.fn('speed_inc');
    eq(await mc.score('.speed', 'ir'), 12, '8 -> 12 (+.SPEEDSTEP from 8 up)');
  });

  test('reset returns to the config default', async ({ mc, expected }) => {
    await mc.fn('speed_inc');
    await mc.fn('speed_inc');
    await mc.fn('speed_reset');
    eq(await mc.score('.speed', 'ir'), expected.get('.DEFAULTSPEED'), 'after [Reset]');
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
    // A land speed quietly adjusted some time ago must not survive a Reset:
    // the reset is TOTAL (all three cruises), so one mid-ocean Reset also
    // guarantees the default land speed comes back when the sprint ends --
    // the "ocean speed never reset over land" complaint was a remembered
    // land-speed adjustment outliving the reset.
    await mc.setScore('.speed', 'ir', 40);
    await mc.fn('speed_reset');
    eq(await mc.score('.ocnspd', 'ir'), ocean, 'Reset returns the ocean cruise to .OCEANSPEED');
    eq(await mc.score('.speed', 'ir'), expected.get('.DEFAULTSPEED'), 'Reset ALSO returns the land speed to its default (total reset)');
    eq(await mc.score('.skyspd', 'ir'), expected.get('.SKYSPEED'), 'Reset ALSO returns the sky cruise to its default (total reset)');
    eq(await mc.score('.spdflt', 'ir'), 1, '.spdflt answers the ocean default');
  });

  test('speed_down restores the land speed and clears .fast', async ({ mc, expected }) => {
    await mc.fn('speed_down');
    eq(await mc.score('.fast', 'ir'), 0, '.fast cleared');
    const rule = await speedRule(mc);
    if (rule !== null) eq(rule, expected.get('.DEFAULTSPEED'), 'gamerule back to the land speed');
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

  // Raise-only ocean speed-up: the sprint must never SLOW the ride. speed_up
  // lifts a slow rider up to the ocean speed, but keeps a faster rider's speed;
  // speed_down carries a fast speed onto land, else restores the pre-ocean one.
  test('ocean entry is RAISE-ONLY: a land speed above the ocean speed is kept, not lowered', async ({ mc, expected }) => {
    const ocean = expected.get('.OCEANSPEED');   // 32
    const fast = ocean + 8;                       // 40: the rider was already going faster than the ocean speed
    await mc.setScore('.SKYMODE', 'ir', 0);
    await mc.setScore('.fast', 'ir', 0);
    await mc.setScore('.speed', 'ir', fast);
    await mc.fn('speed_up');
    eq(await mc.score('.ocnspd', 'ir'), fast, 'ocean cruise raised to the faster land speed, not dropped to .OCEANSPEED');
    eq(await mc.score('.speed', 'ir'), fast, 'the pre-ocean land speed is preserved (untouched) for the return');
    eq(await mc.score('.fast', 'ir'), 1, '.fast raised');
    const rule = await speedRule(mc);
    if (rule !== null) eq(rule, fast, 'gamerule kept the faster speed -- the ocean never slows you');
  });

  test('ocean entry raises a SLOW land speed up to the ocean speed', async ({ mc, expected }) => {
    const ocean = expected.get('.OCEANSPEED');
    const land = expected.get('.DEFAULTSPEED'); // 8: below the ocean speed
    await mc.setScore('.SKYMODE', 'ir', 0);
    await mc.setScore('.fast', 'ir', 0);
    await mc.setScore('.speed', 'ir', land);
    await mc.fn('speed_up');
    eq(await mc.score('.ocnspd', 'ir'), ocean, 'ocean cruise raised to .OCEANSPEED');
    eq(await mc.score('.speed', 'ir'), land, 'land speed untouched, held for the return');
    const rule = await speedRule(mc);
    if (rule !== null) eq(rule, ocean, 'gamerule got the ocean cruise');
  });

  test('return to land keeps a speed ABOVE the ocean speed (raise-only); Reset still returns to the default', async ({ mc, expected }) => {
    const ocean = expected.get('.OCEANSPEED');
    const fast = ocean + 8; // 40: came in fast, or sped up mid-sprint
    await mc.setScore('.SKYMODE', 'ir', 0);
    await mc.setScore('.fast', 'ir', 1);
    await mc.setScore('.ocnspd', 'ir', fast);
    await mc.setScore('.speed', 'ir', expected.get('.DEFAULTSPEED'));
    await mc.fn('speed_down');
    eq(await mc.score('.fast', 'ir'), 0, '.fast cleared');
    eq(await mc.score('.speed', 'ir'), fast, 'the faster speed carries onto land -- never slowed on return');
    const rule = await speedRule(mc);
    if (rule !== null) eq(rule, fast, 'gamerule kept the faster speed');
    // The "reset speed" is the config default on land, whatever speed the rider is at.
    await mc.fn('speed_reset');
    eq(await mc.score('.speed', 'ir'), expected.get('.DEFAULTSPEED'), 'Reset on land returns to the true default');
  });

  test('return to land restores the pre-ocean speed when the cruise was the ocean speed or below', async ({ mc, expected }) => {
    const ocean = expected.get('.OCEANSPEED');
    const preOcean = 6;
    await mc.setScore('.SKYMODE', 'ir', 0);
    await mc.setScore('.fast', 'ir', 1);
    await mc.setScore('.ocnspd', 'ir', ocean);  // was cruising at the ocean speed
    await mc.setScore('.speed', 'ir', preOcean); // the land speed before the sprint
    await mc.fn('speed_down');
    eq(await mc.score('.fast', 'ir'), 0, '.fast cleared');
    eq(await mc.score('.speed', 'ir'), preOcean, 'restored the pre-ocean land speed');
    const rule = await speedRule(mc);
    if (rule !== null) eq(rule, preOcean, 'gamerule restored to the pre-ocean speed');
  });
});
