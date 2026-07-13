// The auto-start world-age gate (auto_gate / auto_aged): a fresh world
// auto-starts as before, but an EXISTING/played world (older than
// .WORLDAGEWARN minutes of game time) is NOT auto-started -- the gate latches
// .autodone and warns instead, and a manual start still works regardless.
//
// The real auto-start COUNTDOWN needs a real player (`if entity @a`), which
// the headless surrogate can't be -- but auto_gate itself is a plain function
// reading `time query gametime`, so it's driven directly here.
import { defineSuite, eq, ok } from '../lib/harness.mjs';
import { startRide, stopRide } from '../lib/ride.mjs';

export default defineSuite('auto-start world-age gate', ({ test }) => {
  test('fresh world is not blocked (autodone stays clear)', async (ctx) => {
    const mc = ctx.mc;
    // The guard knob must have been applied from the shipped config.
    eq(await mc.score('.WORLDAGEWARN', 'ir'), ctx.expected.get('.WORLDAGEWARN'),
      'config applied .WORLDAGEWARN');
    await mc.setScore('.autodone', 'ir', 0);
    // A just-booted world is far younger than the default 15-minute threshold.
    const g = await mc.gametime();
    ok(g < ctx.expected.get('.WORLDAGEWARN') * 1200,
      `precondition: fresh gametime (${g}) below the ${ctx.expected.get('.WORLDAGEWARN')}-min threshold`);
    await mc.fn('auto_gate');
    eq(await mc.score('.autodone', 'ir'), 0, 'auto_gate left autodone clear on a fresh world');
    ctx.note(`fresh gametime=${g}`);
  });

  test('aged world trips the guard (autodone latched)', async (ctx) => {
    const mc = ctx.mc;
    await mc.setScore('.autodone', 'ir', 0);
    // Guarantee at least one minute (1200 ticks) of game time has run, then
    // set the threshold to one minute so the current age is over it. No player
    // is connected, so this sprint never trips the real auto-starter itself.
    let g = await mc.gametime();
    if (g < 1300) { await mc.sprint(1300 - g); g = await mc.gametime(); }
    ok(g >= 1200, `precondition: gametime (${g}) >= 1-min threshold`);
    await mc.setScore('.WORLDAGEWARN', 'ir', 1); // threshold = 1 * 1200 ticks
    await mc.fn('auto_gate');
    eq(await mc.score('.autodone', 'ir'), 1, 'auto_gate latched autodone on an aged world');
    ctx.note(`aged gametime=${g}, threshold=1200`);
  });

  test('guard disabled (.WORLDAGEWARN 0) never blocks', async (ctx) => {
    const mc = ctx.mc;
    await mc.setScore('.autodone', 'ir', 0);
    await mc.setScore('.WORLDAGEWARN', 'ir', 0);
    // Game time is well past any threshold by now, but the guard is off.
    await mc.fn('auto_gate');
    eq(await mc.score('.autodone', 'ir'), 0, 'auto_gate did nothing while the guard is disabled');
    await mc.setScore('.WORLDAGEWARN', 'ir', ctx.expected.get('.WORLDAGEWARN')); // restore
  });

  test('manual start ignores the guard (autodone pre-latched)', async (ctx) => {
    const mc = ctx.mc;
    // Simulate a world the gate already blocked, then start deliberately:
    // begin() never consults .autodone, so the escape hatch must still work.
    await mc.setScore('.autodone', 'ir', 1);
    await startRide(mc);
    eq(await mc.score('.started', 'ir'), 1, 'begin started the ride despite autodone=1');
    await stopRide(mc);
  });
});
