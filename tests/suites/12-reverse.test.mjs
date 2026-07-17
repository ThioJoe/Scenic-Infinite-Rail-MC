// Stop-and-reverse, live (CONTEXT 6.10): a real ride is parked at 0 with
// Speed − clicks, then run BACKWARDS at a negative speed over its own
// track -- with the watchdog staying quiet (its direction awareness is the
// no-false-positives proof), the ocean system standing down, chunks behind
// re-loading (the reverse roller), and the ride parking itself when the
// pace cart reaches the start (west end) of the remembered track. Speed +
// then heads east again.
//
// Negative-hypothesis controls are built in: the same movement detector
// first proves the ride DOES advance forward (so "cartX unchanged" while
// parked, and "cartX decreases" while reversing, are meaningful), and the
// ocean-counter freeze check first proves the counters DO move during
// forward travel.

import { defineSuite, eq, ok, between } from '../lib/harness.mjs';
import { startRide, summonRig, stopRide } from '../lib/ride.mjs';

async function speedRule(mc) {
  const rule = await mc.storageString('infinite_rail:speed', 'rule');
  const r = await mc.cmd(`gamerule ${rule}`);
  const m = r.match(/currently set to: (-?\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

export default defineSuite('stop and reverse (live ride)', ({ test }) => {
  test('control: the ride advances forward and the ocean counters tick', { timeout: 240000 }, async ({ mc, state }) => {
    await startRide(mc);
    await summonRig(mc); // ocean_check samples at the seat -- give it one
    // The fixed test seed's spawn is ocean-heavy: disable the ocean SPRINT
    // (.OCEANSPEED 0 -- a live-tweak, wiped on reload) so .fast can never
    // flip mid-suite and steal the Speed clicks for the ocean cruise. The
    // ocean COUNTERS still tick (only speed_up is gated on the knob), so
    // the counter-freeze assertions below stay meaningful.
    await mc.setScore('.OCEANSPEED', 'cfg_ride', 0);
    await mc.setScore('.fast', 'ir', 0);
    // A sprint may already have pushed the gamerule to 32 during the first
    // ride ticks -- reset puts the land default back on the rails.
    await mc.fn('speed_reset');
    // Plant sentinel ocean-counter values: forward chunk crossings must
    // disturb them (one of the two runs advances/zeroes on every crossing).
    await mc.setScore('.oceanRun', 'ir', 77);
    await mc.setScore('.landRun', 'ir', 77);
    const x0 = await mc.score('.cartX', 'ir');
    await mc.sprint(200);
    const x1 = await mc.score('.cartX', 'ir');
    ok(x1 > x0 + 40, `forward control: cart advanced ${x0} -> ${x1}`);
    const oc = await mc.score('.oceanRun', 'ir');
    const lc = await mc.score('.landRun', 'ir');
    ok(oc !== 77 || lc !== 77, `forward control: ocean counters ticked (${oc}/${lc})`);
    state.railRule = await speedRule(mc);
  });

  test('seven Speed − clicks park the ride at 0', { timeout: 180000 }, async ({ mc, state }) => {
    for (let i = 0; i < 7; i++) await mc.fn('speed_dec'); // 8,6,5,4,3,2,1,0
    eq(await mc.score('.speed', 'ir'), 0, '.speed parked at 0');
    if (state.railRule !== null) {
      const rule = await speedRule(mc);
      ok(rule >= 0, `gamerule never negative (got ${rule})`);
    }
    await mc.sprint(100);
    const x0 = await mc.score('.cartX', 'ir');
    await mc.sprint(150);
    const x1 = await mc.score('.cartX', 'ir');
    between(x1 - x0, -1, 1, `parked: cart holds still (${x0} -> ${x1})`);
    eq(await mc.score('.wdfixn', 'ir'), 0, 'no watchdog rescues while parked');
  });

  test('further clicks go negative and the ride runs backwards', { timeout: 240000 }, async ({ mc, state }) => {
    // 0 -> -1 .. -6 -> -8: seven more clicks down the mirrored grid.
    for (let i = 0; i < 7; i++) await mc.fn('speed_dec');
    eq(await mc.score('.speed', 'ir'), -8, '.speed at -8 (the mirrored bridge)');
    if (state.railRule !== null) eq(await speedRule(mc), 8, 'gamerule holds the magnitude 8');
    // Freeze sentinels: while reversing the ocean system must stand down.
    await mc.setScore('.oceanRun', 'ir', 77);
    await mc.setScore('.landRun', 'ir', 77);
    const x0 = await mc.score('.cartX', 'ir');
    await mc.sprint(200);
    const x1 = await mc.score('.cartX', 'ir');
    ok(x1 < x0 - 30, `reversing: cart ran backwards ${x0} -> ${x1}`);
    eq(await mc.score('.oceanRun', 'ir'), 77, 'ocean counter frozen while reversing');
    eq(await mc.score('.landRun', 'ir'), 77, 'land counter frozen while reversing');
    eq(await mc.score('.wdfixn', 'ir'), 0, 'no watchdog rescues while reversing');
    // The rig retraces the recorded line behind the cart's lead.
    const seatX = await mc.entityNum('@e[type=item_display,tag=ir_seat,limit=1]', 'Pos[0]');
    ok(seatX !== null && seatX > x1, 'rig still rides its lead east of the pace cart');
  });

  test('the ride parks itself at the start of the track', { timeout: 300000 }, async ({ mc }) => {
    const base = await mc.score('.trackBase', 'ir');
    // Keep reversing until rev_check parks the ride (speed 0), with margin.
    const t0 = Date.now();
    let speed = await mc.score('.speed', 'ir');
    while (speed !== 0 && Date.now() - t0 < 180000) {
      await mc.sprint(200);
      speed = await mc.score('.speed', 'ir');
    }
    eq(speed, 0, 'rev_check zeroed the land speed at the track start');
    const cart = await mc.score('.cartX', 'ir');
    between(cart, base, base + 8, `pace cart parked just inside the start (x ${cart}, base ${base})`);
    await mc.sprint(100);
    const cart2 = await mc.score('.cartX', 'ir');
    between(cart2 - cart, -1, 1, 'parked at the start: no drift');
    eq(await mc.score('.wdfixn', 'ir'), 0, 'still no watchdog rescues');
  });

  test('Speed + heads east again; Reset restores the default', { timeout: 240000 }, async ({ mc, expected }) => {
    await mc.fn('speed_inc'); // 0 -> 1
    eq(await mc.score('.speed', 'ir'), 1, 'one click off parked = 1 east');
    const x0 = await mc.score('.cartX', 'ir');
    await mc.sprint(200);
    const x1 = await mc.score('.cartX', 'ir');
    ok(x1 > x0 + 4, `moving east again (${x0} -> ${x1})`);
    await mc.fn('speed_reset');
    eq(await mc.score('.speed', 'ir'), expected.get('.DEFAULTSPEED'), 'Reset restores the default');
    eq(await mc.score('.spdflt', 'ir'), 1, 'reported as default');
    eq(await mc.score('.wdfixn', 'ir'), 0, 'the whole stop/reverse round trip: zero watchdog rescues');
    await stopRide(mc);
  });
});
