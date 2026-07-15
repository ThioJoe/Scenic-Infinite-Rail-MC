// The auto-start world-age gate (auto_gate / auto_aged): a fresh world
// auto-starts as before, but an EXISTING/played world (older than
// .WORLDAGEWARN minutes of game time) is NOT auto-started -- the gate latches
// .autodone and warns instead, and a manual start still works regardless.
//
// The real auto-start COUNTDOWN needs a real player (`if entity @a`), which
// the headless surrogate can't be -- but auto_gate itself is a plain function
// reading `time query gametime`, so it's driven directly here.
import { defineSuite, eq, ok, between, closeTo } from '../lib/harness.mjs';
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

  test('auto_relocate moves the starter to the western start line, keeping Z', async (ctx) => {
    const mc = ctx.mc;
    // The countdown's relocation runs `as` the player; here a stand stands
    // in (same trick as the surrogate rider). Both ends must be loaded: the
    // origin so the stand can be summoned, the destination so the
    // teleported stand stays selectable for the readback.
    await mc.loadRegion(-8, -8, 24, 24, { settleMs: 1200 });
    await mc.loadRegion(-99016, -16, -98984, 16, { settleMs: 1500 });
    await mc.cmd('kill @e[type=armor_stand,tag=ir_reloc_test]');
    await mc.cmd('summon minecraft:armor_stand 8.5 150 3.5 {Tags:["ir_reloc_test"],NoGravity:1b}');
    await mc.cmd('execute as @e[type=armor_stand,tag=ir_reloc_test,limit=1] run function infinite_rail:auto_relocate');
    const x = await mc.entityNum('@e[type=armor_stand,tag=ir_reloc_test,limit=1]', 'Pos[0]');
    const y = await mc.entityNum('@e[type=armor_stand,tag=ir_reloc_test,limit=1]', 'Pos[1]');
    const z = await mc.entityNum('@e[type=armor_stand,tag=ir_reloc_test,limit=1]', 'Pos[2]');
    closeTo(x, -99000, 0.75, 'relocated to the X -99000 start line');
    eq(Math.round(y), 320, 'dropped in above the build limit (no terrain can swallow the target)');
    closeTo(z, 3.5, 0.25, 'Z preserved -- the line still anchors beside where the player was');
    await mc.cmd('kill @e[type=armor_stand,tag=ir_reloc_test]');
    await mc.unloadRegion(-99016, -16, -98984, 16);
    await mc.unloadRegion(-8, -8, 24, 24);
  });

  test('a ride anchored at the western start line runs clean (negative-X end to end)', { timeout: 300000 }, async (ctx) => {
    const mc = ctx.mc;
    // The auto-start's landing zone: block -99000. Exercises every piece of
    // fixed-point math that must be sign-safe out there -- the camera's
    // floorMod fraction, the watchdog's x10 baselines and block-center
    // staging, the chunk pipeline -- on a genuine ride.
    await startRide(mc, { x: -98999.5, z: 0.5 });
    const base = await mc.score('.trackBase', 'ir');
    between(base, -99001, -98999, `anchored at the start line (trackBase ${base})`);
    eq(await mc.score('.lineZ', 'ir'), 14, 'centerline snap unaffected by negative X');
    await mc.sprint(400, { timeoutMs: 180000 });
    const cartX = await mc.entityNum('@e[type=minecart,tag=ir_cart,limit=1]', 'Pos[0]');
    ok(cartX > base + 30, `cart rolls east through negative territory (at ${cartX.toFixed(1)})`);
    eq(await mc.score('.wdfixn', 'ir'), 0, 'watchdog quiet at -99k (sign-safe fixed point)');
    eq(await mc.score('.hdmiss', 'ir'), 0, 'head never went missing at -99k');
    eq(await mc.score('.flok', 'ir'), 1, 'forceload pipeline healthy at -99k');
    await stopRide(mc);
  });
});
