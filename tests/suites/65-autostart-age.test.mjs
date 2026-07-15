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

  test('auto_prep generates the landing pad; auto_ready clears the hold once it exists', { timeout: 180000 }, async (ctx) => {
    const mc = ctx.mc;
    // Phase 1 of the polished auto-start: the countdown's first tick queues
    // the landing pad's chunks (no player involved), and the start is held
    // by auto_ready until they are really loaded. Poll like the tick loop
    // does: preset .relok 1, run the probe, read it back.
    await mc.fn('auto_prep');
    const r = await mc.cmd('forceload query -99000 14');
    ok(/is marked for force loading/.test(r), `the pad's anchor chunk is forceloaded: ${r}`);
    const t0 = Date.now();
    let ready = false;
    while (Date.now() - t0 < 60000) {
      await mc.setScore('.relok', 'ir', 1);
      await mc.fn('auto_ready');
      if (await mc.score('.relok', 'ir') === 1) { ready = true; break; }
      await new Promise((res) => setTimeout(res, 1000));
    }
    ok(ready, 'auto_ready cleared the hold once the pad generated (.relok stayed 1)');
    await mc.cmd('forceload remove -99032 -18 -98936 46'); // leave no pad behind for later tests
  });

  test('auto_place drops the starter on the start line (block -99000, the Z 14 centerline)', async (ctx) => {
    const mc = ctx.mc;
    // Phase 2, at the countdown's END: `as` the player, tp to the pad --
    // begin then seats them the same tick. A stand stands in; both ends
    // must be loaded for the summon and the readback.
    await mc.loadRegion(-8, -8, 24, 24, { settleMs: 1200 });
    await mc.loadRegion(-99016, -2, -98984, 30, { settleMs: 1200 });
    await mc.cmd('kill @e[type=armor_stand,tag=ir_reloc_test]');
    await mc.cmd('summon minecraft:armor_stand 8.5 150 3.5 {Tags:["ir_reloc_test"],NoGravity:1b}');
    await mc.cmd('execute as @e[type=armor_stand,tag=ir_reloc_test,limit=1] run function infinite_rail:auto_place');
    const x = await mc.entityNum('@e[type=armor_stand,tag=ir_reloc_test,limit=1]', 'Pos[0]');
    const z = await mc.entityNum('@e[type=armor_stand,tag=ir_reloc_test,limit=1]', 'Pos[2]');
    closeTo(x, -98999.5, 0.25, 'landed on block -99000');
    closeTo(z, 14.5, 0.25, 'landed on the Z ≡ 14 centerline residue (anchor snap of zero)');
    await mc.cmd('kill @e[type=armor_stand,tag=ir_reloc_test]');
    await mc.unloadRegion(-99016, -2, -98984, 30);
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
