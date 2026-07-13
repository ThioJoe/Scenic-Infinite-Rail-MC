// Lifecycle: /reload mid-ride (state survives, config refreshes), stop
// (teardown but the track stays), restart (begin is re-runnable), and a
// stopped world staying stopped.

import { defineSuite, eq, ok, includes } from '../lib/harness.mjs';
import { startRide, stopRide, placeSurrogate, beginRide, awaitLaunched, SURROGATE_TAG, LINE_Z } from '../lib/ride.mjs';

export default defineSuite('lifecycle: reload / stop / restart', ({ test }) => {
  test('/reload mid-ride keeps state, refreshes config, ride keeps building', { timeout: 300000 }, async ({ mc, expected, state, note }) => {
    await startRide(mc);
    // Player-chosen state (must survive a reload)...
    await mc.fn('speed_inc');
    await mc.fn('speed_inc');
    eq(await mc.score('.speed', 'ir'), expected.get('.DEFAULTSPEED') + 8, 'speed adjusted');
    await mc.fn('torch_density_high');
    // ...vs a live config tweak (must be reset by the reload).
    await mc.setScore('.HOVER', 'cfg_terrain', 99);

    await mc.cmd('reload');
    await new Promise((r) => setTimeout(r, 2000));

    eq(await mc.score('.started', 'ir'), 1, 'ride still running after /reload');
    eq(await mc.score('.speed', 'ir'), expected.get('.DEFAULTSPEED') + 8, 'chosen speed survived the reload');
    eq(await mc.score('.torchdens', 'ir'), 70, 'chosen torch density survived the reload');
    eq(await mc.score('.TORCHMODE', 'ir'), 2, 'torch tri-state untouched');
    eq(await mc.score('.HOVER', 'cfg_terrain'), expected.get('.HOVER'), 'live tweak reset to config.mcfunction');
    const tunnel = await mc.score('.TUNNELCLEAR', 'cfg_terrain');
    eq(await mc.score('.TUNNELUP', 'ir'), tunnel + 1, '.TUNNELUP re-derived');

    const h0 = await mc.score('.headX', 'ir');
    await mc.sprint(100, { timeoutMs: 90000 });
    const h1 = await mc.score('.headX', 'ir');
    note(`built ${h1 - h0} columns in 100 ticks after the reload`);
    ok(h1 > h0, 'build loop still alive after the reload');
    await mc.fn('speed_reset');
  });

  test('stop tears the ride down but leaves the track in the world', async ({ mc, state }) => {
    // Remember a mid-track column to verify it survives the stop.
    const base = await mc.score('.trackBase', 'ir');
    const len = await mc.trackLen();
    const i = Math.floor(len / 2);
    state.keptColumn = { x: base + i, y: await mc.trackY(i) };

    await stopRide(mc);
    eq(await mc.score('.started', 'ir'), 0, '.started cleared');
    eq(await mc.score('.autodone', 'ir'), 1, '.autodone stays set (no auto-restart)');
    for (const sel of [
      '@e[type=minecart,tag=ir_cart]', '@e[type=minecart,tag=ir_ride]',
      '@e[type=item_display,tag=ir_seat]', '@e[type=item_display,tag=ir_plug]',
      '@e[type=marker,tag=ir_head]', '@e[type=marker,tag=ir_probe]',
    ]) {
      eq(await mc.entityExists(sel), false, `${sel} killed by stop`);
    }
    const fl = await mc.cmd('forceload query');
    ok(!/\[-?\d+, -?\d+\]/.test(fl), `forceloads cleared (got: ${fl.slice(0, 120)})`);
  });

  test('built track physically survives the stop', async ({ mc, state }) => {
    const { x, y } = state.keptColumn;
    await mc.loadRegion(x - 1, LINE_Z - 2, x + 1, LINE_Z + 2, { settleMs: 1000 });
    eq(await mc.blockIs(x, y, LINE_Z, 'minecraft:powered_rail'), 'match', `rail at ${x},${y},${LINE_Z} left in the world`);
    await mc.unloadRegion(x - 1, LINE_Z - 2, x + 1, LINE_Z + 2);
  });

  test('a stopped world stays stopped across /reload', async ({ mc }) => {
    await mc.cmd('reload');
    await new Promise((r) => setTimeout(r, 2000));
    await mc.sprint(60, { timeoutMs: 60000 });
    eq(await mc.score('.started', 'ir'), 0, 'no auto-restart after reload (.autodone gate)');
  });

  test('start is safely re-runnable: a second ride launches cleanly', { timeout: 300000 }, async ({ mc }) => {
    await placeSurrogate(mc, { z: 64.5 }); // a fresh strip
    await beginRide(mc);
    eq(await mc.score('.started', 'ir'), 2, 'second launch seeded');
    await awaitLaunched(mc);
    eq(await mc.score('.started', 'ir'), 1, 'second ride running');
    await mc.freeze(); // consistency reads need a paused build loop
    try {
      const len = await mc.trackLen();
      const headX = await mc.score('.headX', 'ir');
      const base = await mc.score('.trackBase', 'ir');
      eq(len, headX - base + 1, 'fresh track history for the new ride');
    } finally {
      await mc.unfreeze();
    }
    await stopRide(mc);
  });
});
