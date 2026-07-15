// The pace-cart stop watchdog (pace_watch / pace_fix): the 3-second check
// that rescues a derailed / vanished / wedged pace cart by snapping it back
// onto the built track.
//
// Three things are under test, per the design brief:
//   1. It fires ONLY when needed -- no false trigger from ocean speed-ups,
//      sky mode, user speed changes (including instant 1 <-> 32 flaps and
//      Speed-item grid walks). Those tests hard-assert .wdfixn stays 0.
//   2. It fires WHEN needed -- a paused builder (the field repro), a wall
//      across the track, the cart killed outright, the cart buried
//      underground (the reported bug shape), and a 500 blocks/s
//      terrain-outrun torture run must all end with the cart back on the
//      rails and advancing.
//   3. Lifecycle edges leave it sane -- a brand-new world's first check
//      window, a hard world pause and a slow-motion tick rate, and full
//      world reloads (= singleplayer disconnect/rejoin): healthy rides
//      reload quiet, and a ride that goes down STUCK between two checks
//      must be rescued on schedule after it comes back up.
//
// The whole suite runs on a server pinned to the MINIMUM view/simulation
// distance (3/3) -- emulating the low-power "TV NUC" setup from the field
// report -- which doubles as proof the ride itself works there: the chunk
// pipeline is forceload-driven and must not care about either setting.

import { defineSuite, eq, neq, ok, between, closeTo, includes, skip } from '../lib/harness.mjs';
import { startRide, stopRide, summonRig, SURROGATE_TAG, LINE_Z } from '../lib/ride.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The version-correct minecart max-speed gamerule's current value, or null. */
async function speedRule(mc) {
  const rule = await mc.storageString('infinite_rail:speed', 'rule');
  const r = await mc.cmd(`gamerule ${rule}`);
  const m = r.match(/currently set to: (-?\d+)/);
  return m ? parseInt(m[1], 10) : null;
}
async function setSpeedRule(mc, v) {
  const rule = await mc.storageString('infinite_rail:speed', 'rule');
  await mc.cmd(`gamerule ${rule} ${v}`);
}

async function cartPos(mc) {
  return {
    x: await mc.entityNum('@e[type=minecart,tag=ir_cart,limit=1]', 'Pos[0]'),
    y: await mc.entityNum('@e[type=minecart,tag=ir_cart,limit=1]', 'Pos[1]'),
    z: await mc.entityNum('@e[type=minecart,tag=ir_cart,limit=1]', 'Pos[2]'),
  };
}

/** The physical rail level of column x: min(y[i-1], y[i]) -- see checkColumn. */
async function railLevelAt(mc, x) {
  const base = await mc.score('.trackBase', 'ir');
  const len = await mc.trackLen();
  const i = Math.min(len - 1, Math.max(1, Math.floor(x) - base));
  return Math.min(await mc.trackY(i - 1), await mc.trackY(i));
}

/** Assert the pace cart sits ON the line: centered on Z, at rail height. */
async function assertOnTrack(mc, label) {
  const p = await cartPos(mc);
  closeTo(p.z, LINE_Z + 0.5, 0.75, `${label}: cart Z centered on the line`);
  const rail = await railLevelAt(mc, p.x);
  between(p.y - rail, -0.5, 2.0, `${label}: cart Y ${p.y.toFixed(2)} rides the rail level ${rail}`);
}

/** Sprint and assert the cart advanced more than `min` blocks east. */
async function assertAdvancing(mc, ticks, min, label, timeoutMs = 120000) {
  const x0 = (await cartPos(mc)).x;
  await mc.sprint(ticks, { timeoutMs });
  const x1 = (await cartPos(mc)).x;
  ok(x1 - x0 > min, `${label}: cart advanced ${(x1 - x0).toFixed(1)} blocks in ${ticks} ticks (need > ${min})`);
  return x1;
}

/**
 * A full world unload/reload -- what a singleplayer disconnect + rejoin is.
 * The harness only wipes the world at suite START, so stop + start reboots
 * onto the SAME save; the fresh boot mints a new RCON connection, which the
 * suite's MC wrapper is re-pointed at.
 */
async function rejoinWorld(server, mc) {
  await server.stop();
  await server.start();
  mc.rcon = server.rcon;
  // Wait for the reloaded world to re-activate the forceloaded chunks'
  // entities (the pace cart loads a beat after the chunks themselves; on a
  // slow boot that beat can stretch). No throw on timeout -- the caller's
  // own asserts say what was actually expected.
  const t0 = Date.now();
  while (Date.now() - t0 < 15000) {
    if (await mc.entityExists('@e[type=minecart,tag=ir_cart,limit=1]')) break;
    await sleep(500);
  }
}

export default defineSuite('pace-cart watchdog', {
  server: { props: { 'view-distance': '3', 'simulation-distance': '3' } },
}, ({ test }) => {
  test('ride starts on a minimum-distance server; watchdog armed', { timeout: 240000 }, async ({ mc }) => {
    await startRide(mc);
    await summonRig(mc);
    eq(await mc.score('.lineZ', 'ir'), LINE_Z, 'begin recorded the snapped centerline for recovery teleports');
    eq(await mc.score('.wdfixn', 'ir'), 0, 'no recoveries at launch');
    eq(await mc.score('.wdstuck', 'ir'), 0, 'no stuck streak at launch');
    neq(await mc.score('.wdX', 'ir'), null, 'watchdog baseline X seeded by begin');
    // The brand-new-world edge: the very FIRST check window opens while the
    // cart is still accelerating off its 0.4 summon nudge -- sprint through
    // it and make sure launch acceleration can never read as a stall.
    await mc.sprint(70, { timeoutMs: 60000 });
    eq(await mc.score('.wdfixn', 'ir'), 0, 'first post-launch check window is clean');
    eq(await mc.score('.wdstuck', 'ir'), 0, 'no stuck streak through the first window');
  });

  test('baseline cruise: watchdog never fires', { timeout: 180000 }, async ({ mc }) => {
    await assertAdvancing(mc, 400, 50, 'baseline cruise');
    eq(await mc.score('.wdfixn', 'ir'), 0, 'no recovery on a healthy cruise (.wdfixn)');
    eq(await mc.score('.wdstuck', 'ir'), 0, 'no stuck streak on a healthy cruise');
    eq(await mc.score('.wdmiss', 'ir'), 0, 'cart never read as missing');
  });

  test('stress: instant speed flaps (1 <-> 32) never fire it', { timeout: 300000 }, async ({ mc, expected }) => {
    if (await speedRule(mc) === null) skip('minecart max-speed gamerule missing on this server (see version-compat suite)');
    for (let i = 0; i < 5; i++) {
      await setSpeedRule(mc, 32);
      await mc.sprint(40, { timeoutMs: 60000 });
      await setSpeedRule(mc, 1);
      // 80 ticks at 1 block/s = 4 blocks per watchdog window -- the slowest
      // speed the pack allows must clear the 1.5-block bar with margin.
      await mc.sprint(80, { timeoutMs: 60000 });
    }
    await setSpeedRule(mc, expected.get('.DEFAULTSPEED'));
    eq(await mc.score('.wdfixn', 'ir'), 0, 'no recovery across ten instant speed flips (.wdfixn)');
    eq(await mc.score('.wdstuck', 'ir'), 0, 'no stuck streak across the flaps');
  });

  test('stress: Speed-item grid walk never fires it', { timeout: 180000 }, async ({ mc }) => {
    for (let i = 0; i < 4; i++) {
      await mc.fn('speed_inc');
      await mc.sprint(40, { timeoutMs: 60000 });
    }
    await mc.fn('speed_reset');
    await mc.sprint(120, { timeoutMs: 60000 });
    eq(await mc.score('.wdfixn', 'ir'), 0, 'no recovery across Speed +/Reset clicks (.wdfixn)');
  });

  test('stress: sky mode up and back never fires it', { timeout: 300000 }, async ({ mc, expected }) => {
    await mc.fn('mode_sky_on');
    await mc.sprint(500, { timeoutMs: 180000 });
    eq(await mc.score('.railY', 'ir'), expected.get('.SKYY'), 'the line climbed to the sky altitude');
    eq(await mc.score('.wdfixn', 'ir'), 0, 'no recovery during the sky climb (.wdfixn)');
    await mc.fn('mode_sky_off');
    await mc.sprint(400, { timeoutMs: 180000 });
    eq(await mc.score('.wdfixn', 'ir'), 0, 'no recovery during the glide back down');
    eq(await mc.score('.wdstuck', 'ir'), 0, 'no stuck streak after sky mode');
  });

  test('edge: world freeze and slow-motion tick rate never fire it', { timeout: 240000 }, async ({ mc }) => {
    const fired0 = await mc.score('.wdfixn', 'ir');
    // A hard pause (vanilla's own pause-when-empty, an integrated-server
    // lag freeze, /tick freeze): zero ticks pass, so the tick-driven
    // watchdog clock must not accumulate wall-clock grievances.
    await mc.freeze();
    await sleep(8000); // ~2.5 watchdog intervals of WALL time, 0 ticks
    await mc.unfreeze();
    await mc.sprint(100, { timeoutMs: 60000 });
    eq(await mc.score('.wdfixn', 'ir'), fired0, 'no recovery after a hard world pause');
    // A crawling server (tick rate 5 = each tick 4x longer in real time):
    // per-tick cart movement is unchanged, so a full check window under
    // slow-motion must read exactly like a normal one.
    await mc.cmd('tick rate 5');
    try {
      await sleep(14000); // ~70 slow ticks -- at least one full check window
    } finally {
      await mc.cmd('tick rate 20');
    }
    eq(await mc.score('.wdfixn', 'ir'), fired0, 'no recovery across a slow-motion stretch');
    eq(await mc.score('.wdstuck', 'ir'), 0, 'no stuck streak from pauses or slow-motion');
  });

  test('edge: disconnect + rejoin (full world reload) mid-cruise never fires it', { timeout: 420000 }, async ({ mc, server, note }) => {
    const fired0 = await mc.score('.wdfixn', 'ir');
    await rejoinWorld(server, mc);
    eq(await mc.score('.started', 'ir'), 1, 'ride state survived the reload');
    await mc.sprint(200, { timeoutMs: 120000 });
    const carts = await mc.storeResult('execute if entity @e[type=minecart,tag=ir_cart]');
    eq(carts, 1, 'exactly one pace cart after the reload (no rejoin-race twin survived)');
    await assertAdvancing(mc, 120, 20, 'post-rejoin cruise');
    const fired = (await mc.score('.wdfixn', 'ir')) - fired0;
    between(fired, 0, 1, `a healthy rejoin must not trip the watchdog (a single slow-entity-load rescue is tolerated; got ${fired})`);
    eq(await mc.score('.wdstuck', 'ir'), 0, 'no stuck streak after the rejoin');
    note(`healthy reload: ${fired} recovery(ies); .wdt and .wdX persist, so the interrupted check window still measures a full 60 ticks of movement`);
  });

  test('torture: 500 blocks/s outruns terrain generation -- ride survives', { timeout: 600000 }, async ({ mc, expected, note }) => {
    if (await speedRule(mc) === null) skip('minecart max-speed gamerule missing on this server (see version-compat suite)');
    const fired0 = await mc.score('.wdfixn', 'ir');
    await setSpeedRule(mc, 500);
    await mc.sprint(400, { timeoutMs: 300000 });
    await setSpeedRule(mc, expected.get('.DEFAULTSPEED'));
    // Recovery window: give the watchdog a few 60-tick cycles to put the
    // cart back on rails and the builder time to catch up at sane speed.
    await mc.sprint(400, { timeoutMs: 180000 });
    const fired = (await mc.score('.wdfixn', 'ir')) - fired0;
    note(`watchdog recoveries during the 500 b/s torture run: ${fired} (0 = the builder kept up; >0 = the watchdog earned its keep)`);
    ok(await mc.entityExists('@e[type=minecart,tag=ir_cart,limit=1]'), 'pace cart alive after the torture run');
    await assertOnTrack(mc, 'after torture');
    await assertAdvancing(mc, 200, 30, 'post-torture cruise');
    eq(await mc.score('.wdstuck', 'ir'), 0, 'stuck streak cleared -- the ride is healthy again');
  });

  test('field repro: builder paused (head lost) -- cart flies off the track end, watchdog holds the line', { timeout: 420000 }, async ({ mc, expected, note }) => {
    if (await speedRule(mc) === null) skip('minecart max-speed gamerule missing on this server (see version-compat suite)');
    const fired0 = await mc.score('.wdfixn', 'ir');
    await mc.freeze();
    let headX, railY;
    try {
      headX = await mc.score('.headX', 'ir');
      railY = await mc.score('.railY', 'ir');
      // The field failure: terrain can't load/generate fast enough, so the
      // head gate pauses building coherently -- emulated by removing the
      // head marker outright -- while the cart keeps eating the remaining
      // ~224-block track buffer, flies off the end and derails.
      await mc.cmd('kill @e[type=marker,tag=ir_head]');
    } finally {
      await mc.unfreeze();
    }
    await setSpeedRule(mc, 32); // eat the buffer in ~7s instead of ~28s
    await mc.sprint(300, { timeoutMs: 120000 });
    await mc.sprint(240, { timeoutMs: 120000 });
    // Measure BEFORE restoring, assert AFTER: a failed assert must not leave
    // the world headless for every later test in the suite.
    const headStayed = await mc.score('.headX', 'ir');
    const fired = (await mc.score('.wdfixn', 'ir')) - fired0;
    const pinnedX = (await cartPos(mc)).x;
    // "Terrain caught up": restore the head where it was and let building resume.
    await mc.cmd(`summon minecraft:marker ${headX + 0.5} ${railY} ${LINE_Z + 0.5} {Tags:["ir_head"]}`);
    await setSpeedRule(mc, expected.get('.DEFAULTSPEED'));
    eq(headStayed, headX, 'builder stayed coherently paused (head gate)');
    ok(fired >= 1, `watchdog held the cart at the track end (recoveries: ${fired})`);
    ok(pinnedX < headX + 100, `cart pinned near the track end (${pinnedX.toFixed(1)} vs head ${headX}) -- never ran away east`);
    await mc.sprint(300, { timeoutMs: 180000 });
    ok((await mc.score('.headX', 'ir')) > headX + 50, 'builder resumed once the head came back');
    await assertOnTrack(mc, 'after the paused-builder episode');
    await assertAdvancing(mc, 120, 20, 'post-episode cruise');
    eq(await mc.score('.wdstuck', 'ir'), 0, 'stuck streak cleared once track came back');
    note(`buffer-starved episode: ${fired} recovery hop(s) while the builder was paused`);
  });

  test('trigger: a solid wall across the track -- watchdog hops the cart free', { timeout: 420000 }, async ({ mc, note }) => {
    await mc.freeze();
    let wallStart, wallEnd;
    const fired0 = await mc.score('.wdfixn', 'ir');
    try {
      const cx = (await cartPos(mc)).x;
      wallStart = Math.floor(cx) + 8;
      wallEnd = wallStart + 3;
      // Replace 4 columns of track -- rails included -- with solid stone,
      // full bore height: the cart slams into it and stops dead, the exact
      // shape of a "dug itself underground / derailed" field failure.
      for (let x = wallStart; x <= wallEnd; x++) {
        const rail = await railLevelAt(mc, x);
        await mc.cmd(`fill ${x} ${rail - 1} ${LINE_Z - 1} ${x} ${rail + 2} ${LINE_Z + 1} minecraft:stone`);
      }
    } finally {
      await mc.unfreeze();
    }
    await mc.sprint(500, { timeoutMs: 240000 });
    const fired = (await mc.score('.wdfixn', 'ir')) - fired0;
    ok(fired >= 1, `watchdog fired on a hard stop (recoveries: ${fired})`);
    let x = (await cartPos(mc)).x;
    if (x <= wallEnd + 1) { await mc.sprint(240, { timeoutMs: 120000 }); x = (await cartPos(mc)).x; }
    ok(x > wallEnd + 1, `cart hopped past the wall (${wallStart}..${wallEnd}), now at ${x.toFixed(1)}`);
    await assertAdvancing(mc, 120, 20, 'post-wall cruise');
    eq(await mc.score('.wdstuck', 'ir'), 0, 'stuck streak cleared after the wall');
    note(`freed from a 4-column stone wall with ${fired} recovery hop(s)`);
  });

  test('natural stop: ~70 blocks of lava dumped into the bore -- ride keeps going', { timeout: 420000 }, async ({ mc, note }) => {
    const fired0 = await mc.score('.wdfixn', 'ir');
    await mc.freeze();
    let poolEnd;
    try {
      const cx = (await cartPos(mc)).x;
      const start = Math.floor(cx) + 10;
      poolEnd = start + 11;
      // Fill the open bore cells (replace air) across the full 3-wide strip,
      // rail level and one above: ~70 lava sources around and over the
      // track. Two legitimate outcomes: the per-tick liquid keeper carves a
      // moving air pocket and the cart sails through -- or the lava washes
      // rails out first (lava, unlike water, destroys rails) and the
      // watchdog hops the cart across the gap. Either way the ride must
      // come out the far side moving.
      for (let x = start; x <= poolEnd; x++) {
        const rail = await railLevelAt(mc, x);
        await mc.cmd(`fill ${x} ${rail} ${LINE_Z - 1} ${x} ${rail + 1} ${LINE_Z + 1} minecraft:lava replace minecraft:air`);
      }
    } finally {
      await mc.unfreeze();
    }
    await mc.sprint(400, { timeoutMs: 240000 });
    let x = (await cartPos(mc)).x;
    if (x <= poolEnd + 1) { await mc.sprint(240, { timeoutMs: 120000 }); x = (await cartPos(mc)).x; }
    ok(x > poolEnd + 1, `cart cleared the lava pool (ends ${poolEnd}), now at ${x.toFixed(1)}`);
    const fired = (await mc.score('.wdfixn', 'ir')) - fired0;
    between(fired, 0, 6, `bounded recovery count -- no runaway rescue loop (got ${fired})`);
    eq(await mc.score('.wdstuck', 'ir'), 0, 'stuck streak clear after the lava pool');
    await assertAdvancing(mc, 120, 20, 'post-lava cruise');
    note(`lava crossing needed ${fired} watchdog recovery(ies) (0 = keepers alone; more = rails washed out, watchdog hopped the gap)`);
  });

  test('natural stop: ~70 blocks of water dumped into the bore -- ride keeps going', { timeout: 420000 }, async ({ mc, note }) => {
    const fired0 = await mc.score('.wdfixn', 'ir');
    await mc.freeze();
    let poolEnd;
    try {
      const cx = (await cartPos(mc)).x;
      const start = Math.floor(cx) + 10;
      poolEnd = start + 11;
      for (let x = start; x <= poolEnd; x++) {
        const rail = await railLevelAt(mc, x);
        await mc.cmd(`fill ${x} ${rail} ${LINE_Z - 1} ${x} ${rail + 1} ${LINE_Z + 1} minecraft:water replace minecraft:air`);
      }
    } finally {
      await mc.unfreeze();
    }
    await mc.sprint(400, { timeoutMs: 240000 });
    let x = (await cartPos(mc)).x;
    if (x <= poolEnd + 1) { await mc.sprint(240, { timeoutMs: 120000 }); x = (await cartPos(mc)).x; }
    ok(x > poolEnd + 1, `cart cleared the water pool (ends ${poolEnd}), now at ${x.toFixed(1)}`);
    const fired = (await mc.score('.wdfixn', 'ir')) - fired0;
    // Water cannot break rails (they block/waterlog) and the liquid keeper
    // clears the cart's own cells every tick -- but terrain decides how hard
    // the pool floods back (a pool poured across a descent feeds itself), so
    // a genuinely-crawling cart legitimately earns a few rescues. The bound
    // exists to catch a runaway false-positive loop, not to forbid rescues.
    between(fired, 0, 4, `bounded recovery count on a water crossing (got ${fired})`);
    eq(await mc.score('.wdstuck', 'ir'), 0, 'stuck streak clear after the water pool');
    note(`water crossing needed ${fired} watchdog recovery(ies)`);
  });

  test('trigger: cart and plug killed outright -- re-summoned on the rails, re-plugged', { timeout: 300000 }, async ({ mc }) => {
    const fired0 = await mc.score('.wdfixn', 'ir');
    await mc.cmd('kill @e[type=minecart,tag=ir_cart]');
    await mc.cmd('kill @e[type=item_display,tag=ir_plug]');
    ok(!(await mc.entityExists('@e[type=minecart,tag=ir_cart,limit=1]')), 'cart is gone');
    // Missing is only acted on at the SECOND consecutive 3s check (a merely
    // unloaded cart gets a chance to come back) -- so within ~2 checks plus
    // margin the ride must be whole again.
    await mc.sprint(300, { timeoutMs: 120000 });
    ok(await mc.entityExists('@e[type=minecart,tag=ir_cart,limit=1]'), 'pace cart re-summoned');
    ok(await mc.entityExists('@e[type=item_display,tag=ir_plug,limit=1]'), 'plug re-summoned');
    const passengers = await mc.cmd('data get entity @e[type=minecart,tag=ir_cart,limit=1] Passengers[0].Tags');
    includes(passengers, 'ir_plug', 'plug re-mounted onto the fresh cart by the keeper');
    between((await mc.score('.wdfixn', 'ir')) - fired0, 1, 2, 'exactly the nuke recovery fired (no runaway)');
    eq(await mc.score('.wdmiss', 'ir'), 0, 'missing streak cleared');
    await assertOnTrack(mc, 'after nuke');
    await assertAdvancing(mc, 120, 20, 'post-nuke cruise');
  });

  test('trigger: cart buried 8 blocks under the track -- snapped back onto the rails', { timeout: 300000 }, async ({ mc }) => {
    const fired0 = await mc.score('.wdfixn', 'ir');
    // Deterministic burial (the reported "dug itself underground" shape):
    // solidify a stone pocket 8 below the cart, then drop the cart into it.
    // Whatever is naturally down there (open cave, ocean water) the cart
    // ends up encased -- X frozen, the exact signature the watchdog reads.
    await mc.freeze();
    try {
      const p = await cartPos(mc);
      const bx = Math.floor(p.x); const by = Math.floor(p.y) - 8; const bz = Math.floor(p.z);
      await mc.cmd(`fill ${bx - 1} ${by - 1} ${bz - 1} ${bx + 1} ${by + 1} ${bz + 1} minecraft:stone`);
      await mc.cmd(`tp @e[type=minecart,tag=ir_cart,limit=1] ${bx + 0.5} ${by} ${bz + 0.5}`);
    } finally {
      await mc.unfreeze();
    }
    await mc.sprint(300, { timeoutMs: 120000 });
    ok((await mc.score('.wdfixn', 'ir')) > fired0, 'watchdog rescued the buried cart');
    await assertOnTrack(mc, 'after burial');
    await assertAdvancing(mc, 120, 20, 'post-burial cruise');
    eq(await mc.score('.wdstuck', 'ir'), 0, 'stuck streak cleared after the burial');
  });

  test('edge: disconnect + rejoin while stuck, BETWEEN checks -- fixed after the reload, not before', { timeout: 420000 }, async ({ mc, server, note }) => {
    const fired0 = await mc.score('.wdfixn', 'ir');
    let buriedY;
    await mc.freeze();
    try {
      const p = await cartPos(mc);
      const bx = Math.floor(p.x); const by = Math.floor(p.y) - 8; const bz = Math.floor(p.z);
      buriedY = by;
      await mc.cmd(`fill ${bx - 1} ${by - 1} ${bz - 1} ${bx + 1} ${by + 1} ${bz + 1} minecraft:stone`);
      await mc.cmd(`tp @e[type=minecart,tag=ir_cart,limit=1] ${bx + 0.5} ${by} ${bz + 0.5}`);
      // Force "between checks": the clock (.wdt counts up to 60) is pushed
      // far below the threshold, so no check can fire in the handful of
      // ticks between unfreeze and the server going down -- the player
      // disconnects with the cart stuck and NOT yet rescued.
      await mc.setScore('.wdt', 'ir', -200);
    } finally {
      await mc.unfreeze();
    }
    await rejoinWorld(server, mc);
    eq(await mc.score('.wdfixn', 'ir'), fired0, 'no rescue happened before the reload -- the world went down mid-interval, cart still stuck');
    const y = (await cartPos(mc)).y;
    ok(Math.abs(y - buriedY) < 2, `the stuck cart itself survived the reload (Y ${y?.toFixed?.(1)} ~ buried ${buriedY})`);
    // The persisted clock resumes counting: -200 -> 60 is 260 ticks, then
    // the check reads the persisted .wdX baseline and rescues.
    await mc.sprint(400, { timeoutMs: 180000 });
    ok((await mc.score('.wdfixn', 'ir')) > fired0, 'watchdog rescued the cart after the rejoin');
    await assertOnTrack(mc, 'after the mid-stuck rejoin');
    await assertAdvancing(mc, 120, 20, 'post-rejoin-rescue cruise');
    eq(await mc.score('.wdstuck', 'ir'), 0, 'stuck streak cleared');
    note('scoreboard clock, baseline and the buried cart all persisted across the world reload; the rescue fired on schedule after resume');
  });

  test('after all that: core ride state is still coherent', { timeout: 180000 }, async ({ mc, note }) => {
    await mc.freeze();
    try {
      const headX = await mc.score('.headX', 'ir');
      const base = await mc.score('.trackBase', 'ir');
      const len = await mc.trackLen();
      eq(len, headX - base + 1, 'track history still covers every built column exactly once');
      const gap = await mc.score('.gap', 'ir');
      between(gap, 1, (await mc.score('.PACE_CART_BEHIND', 'cfg_ride')) + 24, 'build gap still bounded');
      // Contiguity over the last stretch: recoveries must never have let the
      // virtual line and the physical build diverge.
      let prev = await mc.trackY(len - 200);
      let breaks = 0;
      for (let i = len - 199; i < len; i++) {
        const y = await mc.trackY(i);
        if (Math.abs(y - prev) > 1) breaks++;
        prev = y;
      }
      eq(breaks, 0, '45-degree contiguity intact over the last 200 columns');
      note(`ride covered ${headX - base} columns across the whole gauntlet`);
    } finally {
      await mc.unfreeze();
    }
  });

  test('no unexpected server errors across the gauntlet', async ({ mc, server }) => {
    await stopRide(mc);
    const errs = server.errorsSince(0, { alsoIgnore: [/Failed to load function/] });
    eq(errs.length, 0, `unexpected ERROR lines: ${errs.slice(0, 5).join(' | ')}`);
  });
});
