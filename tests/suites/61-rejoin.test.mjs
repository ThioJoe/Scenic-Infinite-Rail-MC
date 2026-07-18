// The world-rejoin unpark check (shared speed_rejoin + Java's rejoin_check
// dispatcher): a ride that persisted parked at speed 0 must resume at the
// ACTIVE cruise's config default on rejoin -- and NOTHING else may move:
// non-zero speeds, reverse speeds, inactive cruises and stopped worlds all
// stay exactly as saved. The real join path (tick's `if entity @a` firing
// rejoin_check for the first player) can't run headless -- no players ever
// exist here -- so the dispatcher is invoked directly; the load-time arming
// of .rejchk IS covered. NOTE: load arms UNCONDITIONALLY on every (re)load
// -- an earlier build armed only when load ran with nobody online (meaning
// to exempt /reload), which passed here (a dedicated server boots empty)
// but was dead on real singleplayer, where the host is already online when
// the load hook runs. Field-verified; keep the arming unconditional.

import { defineSuite, eq, skip } from '../lib/harness.mjs';
import { startRide, stopRide } from '../lib/ride.mjs';

async function speedRule(mc) {
  const rule = await mc.storageString('infinite_rail:speed', 'rule');
  const r = await mc.cmd(`gamerule ${rule}`);
  const m = r.match(/currently set to: (-?\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

export default defineSuite('rejoin unpark: parked speed resumes at the default', ({ test }) => {
  test('boot armed .rejchk (load arms on every load)', async ({ mc }) => {
    eq(await mc.score('.rejchk', 'ir'), 1, '.rejchk armed by the boot-time load');
  });

  test('a ride parked at 0 resumes at the land default (gamerule follows)', { timeout: 300000 }, async ({ mc, expected }) => {
    await startRide(mc);
    // Freeze for the whole score-manipulation stretch (through the sky-mode
    // test): the live ride would otherwise keep cruising between RCON calls,
    // and the fixed seed is ocean-heavy enough that the REAL ocean check
    // could flip .fast mid-test and steal the checks' active-cruise context.
    await mc.freeze();
    await mc.setScore('.fast', 'ir', 0);
    // Park exactly as the persisted state would look: land cruise 0, and
    // the gamerule already holding the parked magnitude.
    await mc.setScore('.speed', 'ir', 0);
    await mc.setScore('.spush', 'ir', 0);
    await mc.fn('speed_push');
    await mc.fn('rejoin_check');
    eq(await mc.score('.spfix', 'ir'), 1, 'the check reported a fix');
    eq(await mc.score('.rejchk', 'ir'), 0, 'the one-shot disarmed itself');
    eq(await mc.score('.speed', 'ir'), expected.get('.DEFAULTSPEED'), '.speed back to the default');
    const rule = await speedRule(mc);
    if (rule !== null) eq(rule, expected.get('.DEFAULTSPEED'), 'gamerule got the restored speed');
  });

  test('negative control: a chosen non-zero speed is left alone', async ({ mc }) => {
    await mc.setScore('.speed', 'ir', 12);
    await mc.fn('rejoin_check');
    eq(await mc.score('.spfix', 'ir'), 0, 'nothing to fix');
    eq(await mc.score('.speed', 'ir'), 12, 'chosen speed untouched');
  });

  test('negative control: a REVERSING speed is left alone (only exact 0 unparks)', async ({ mc, expected }) => {
    await mc.setScore('.speed', 'ir', -8);
    await mc.fn('rejoin_check');
    eq(await mc.score('.spfix', 'ir'), 0, 'nothing to fix');
    eq(await mc.score('.speed', 'ir'), -8, 'reverse ride keeps rolling backwards');
    await mc.setScore('.speed', 'ir', expected.get('.DEFAULTSPEED'));
  });

  test('parked mid-ocean-sprint: the OCEAN cruise unparks, the land speed stays', async ({ mc, expected }) => {
    await mc.setScore('.fast', 'ir', 1);
    await mc.setScore('.ocnspd', 'ir', 0);
    await mc.setScore('.speed', 'ir', 5); // a chosen land speed that must not move
    await mc.fn('rejoin_check');
    eq(await mc.score('.spfix', 'ir'), 1, 'the check reported a fix');
    eq(await mc.score('.ocnspd', 'ir'), expected.get('.OCEANSPEED'), '.ocnspd back to the ocean default');
    eq(await mc.score('.speed', 'ir'), 5, 'the inactive land cruise untouched');
    await mc.setScore('.fast', 'ir', 0);
    await mc.setScore('.ocnspd', 'ir', expected.get('.OCEANSPEED'));
  });

  test('parked in sky mode: the SKY cruise unparks, the land speed stays', async ({ mc, expected }) => {
    await mc.setScore('.SKYMODE', 'ir', 1); // context only -- no need to steer the ride
    await mc.setScore('.skyspd', 'ir', 0);
    await mc.fn('rejoin_check');
    eq(await mc.score('.spfix', 'ir'), 1, 'the check reported a fix');
    eq(await mc.score('.skyspd', 'ir'), expected.get('.SKYSPEED'), '.skyspd back to the sky default');
    eq(await mc.score('.speed', 'ir'), 5, 'the inactive land cruise untouched');
    await mc.setScore('.SKYMODE', 'ir', 0);
    await mc.setScore('.skyspd', 'ir', expected.get('.SKYSPEED'));
    // Leave the ride at its default land speed for the tests below.
    await mc.setScore('.speed', 'ir', expected.get('.DEFAULTSPEED'));
    await mc.setScore('.spush', 'ir', expected.get('.DEFAULTSPEED'));
    await mc.fn('speed_push');
  });

  test('negative control: a STOPPED world (.started 0) never unparks', async ({ mc }) => {
    await mc.unfreeze(); // teardown + the /reload below want live ticks
    await stopRide(mc);
    await mc.setScore('.speed', 'ir', 0);
    await mc.fn('rejoin_check');
    eq(await mc.score('.spfix', 'ir'), 0, 'no ride, no fix');
    eq(await mc.score('.speed', 'ir'), 0, 'saved speed untouched in a stopped world');
  });

  test('/reload re-arms .rejchk (arming is unconditional -- see the header)', async ({ mc, expected }) => {
    eq(await mc.score('.rejchk', 'ir'), 0, 'precondition: disarmed by the checks above');
    await mc.cmd('reload');
    await new Promise((r) => setTimeout(r, 2000));
    eq(await mc.score('.rejchk', 'ir'), 1, 'load re-armed the one-shot');
    await mc.setScore('.speed', 'ir', expected.get('.DEFAULTSPEED'));
  });
});
