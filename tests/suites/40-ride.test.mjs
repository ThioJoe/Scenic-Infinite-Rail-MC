// The ride bootstrap and build pipeline, end to end on real terrain:
// begin -> phased launch -> launch_done, then the per-tick build loop.
// Verifies both the virtual state (scores, track history) and the physical
// world (rails, supports, lights actually placed where the history says),
// plus the camera rig gliding the recorded profile.

import { defineSuite, eq, ok, between, closeTo, includes } from '../lib/harness.mjs';
import { placeSurrogate, beginRide, awaitLaunched, summonRig, checkColumn, SURROGATE_TAG, LINE_Z } from '../lib/ride.mjs';

export default defineSuite('ride bootstrap & build pipeline', ({ test }) => {
  test('begin seeds the launch (frozen-tick inspection)', async ({ mc, state }) => {
    await placeSurrogate(mc);
    await mc.freeze(); // hold the tick loop so we can inspect phase 2
    await beginRide(mc);

    eq(await mc.score('.started', 'ir'), 2, 'begin hands off to the phased launch');
    eq(await mc.score('.autodone', 'ir'), 1, 'auto-starter disarmed forever');
    const headX = await mc.score('.headX', 'ir');
    const camAhead = (await mc.score('.PACE_CART_BEHIND', 'cfg_ride')) - (await mc.score('.RIDER_BEHIND', 'cfg_camera'));
    eq(await mc.score('.pregoal', 'ir'), headX + camAhead + 32, 'runway goal = start + the rig lead + 32');
    eq(await mc.score('.trackBase', 'ir'), headX, 'track history anchored at the head');
    eq(await mc.trackLen(), 1, 'history holds exactly the first column');
    eq(await mc.trackY(0), await mc.score('.railY', 'ir'), 'column 0 recorded at .railY');
    ok(await mc.entityExists('@e[type=marker,tag=ir_head,limit=1]'), 'head marker summoned');
    ok(await mc.entityExists('@e[type=marker,tag=ir_probe,limit=1]'), 'probe marker summoned');
    ok(await mc.entityExists('@e[type=minecart,tag=ir_cart,limit=1]'), 'pace cart summoned');
    ok(await mc.entityExists('@e[type=item_display,tag=ir_plug,limit=1]'), 'seat plug summoned');
    state.startHeadX = headX;
  });

  test('launch is tick-driven: frozen builds nothing, stepping builds', async ({ mc }) => {
    const h0 = await mc.score('.headX', 'ir');
    await new Promise((r) => setTimeout(r, 1500));
    eq(await mc.score('.headX', 'ir'), h0, 'no columns appear while the game is frozen');
    await mc.step(4);
    const h1 = await mc.score('.headX', 'ir');
    between(h1 - h0, 1, 4 * 24, 'stepped ticks build runway slices (<= 24 columns per tick)');
  });

  test('launch completes: .started 1, runway reaches .pregoal', { timeout: 240000 }, async ({ mc }) => {
    await mc.unfreeze();
    await awaitLaunched(mc);
    const headX = await mc.score('.headX', 'ir');
    ok(headX >= await mc.score('.pregoal', 'ir'), 'head reached the runway goal');
  });

  test('track history covers every built column exactly once', async ({ mc }) => {
    await mc.freeze(); // the ride keeps building between reads otherwise
    try {
      const headX = await mc.score('.headX', 'ir');
      const base = await mc.score('.trackBase', 'ir');
      eq(await mc.trackLen(), headX - base + 1, 'history length = columns built');
    } finally {
      await mc.unfreeze();
    }
  });

  test('rail line is contiguous: every neighbour differs by at most 1', { timeout: 300000 }, async ({ mc, note }) => {
    const len = await mc.trackLen();
    let prev = await mc.trackY(0);
    let minY = prev; let maxY = prev;
    const breaks = [];
    for (let i = 1; i < len; i++) {
      const y = await mc.trackY(i);
      if (Math.abs(y - prev) > 1) breaks.push(`i=${i}: ${prev} -> ${y}`);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      prev = y;
    }
    note(`profile over ${len} columns spans Y ${minY}..${maxY}`);
    eq(breaks.length, 0, `45-degree contiguity broken at: ${breaks.slice(0, 5).join('; ')}`);
  });

  test('physical columns match the history (rail, support, light)', { timeout: 240000 }, async ({ mc, state }) => {
    const len = await mc.trackLen();
    const base = await mc.score('.trackBase', 'ir');
    const z = LINE_Z; // begin snaps the centerline to Z ≡ 14 mod 16
    await mc.loadRegion(base - 1, z - 2, base + len + 1, z + 2, { settleMs: 1500 });
    const bad = [];
    const samples = 14;
    for (let s = 0; s < samples; s++) {
      const i = Math.floor((s * (len - 1)) / (samples - 1));
      const y = await mc.trackY(i);
      const prevY = i > 0 ? await mc.trackY(i - 1) : y;
      const col = await checkColumn(mc, base + i, y, z, prevY);
      if (col.rail !== 'match' || col.support !== 'match' || col.light !== 'match') {
        bad.push(`x=${base + i} y=${y}: rail=${col.rail} support=${col.support} light=${col.light}`);
      }
    }
    eq(bad.length, 0, `columns diverge from the recorded profile: ${bad.join('; ')}`);
    state.checkedRegion = true;
  });

  test('support disguise displays exist along the line', async ({ mc }) => {
    const r = await mc.cmd('execute if entity @e[type=block_display,tag=ir_disp]');
    includes(r, 'Test passed', 'ir_disp block displays present');
    const m = r.match(/Count: (\d+)/);
    ok(m && parseInt(m[1], 10) >= 10, `expected many disguise displays, got ${m?.[1]}`);
  });

  test('pace cart rolls east and the camera rig flies the rig lead ahead', { timeout: 240000 }, async ({ mc, note }) => {
    await summonRig(mc);
    const cartX0 = await mc.entityNum('@e[type=minecart,tag=ir_cart,limit=1]', 'Pos[0]');
    await mc.sprint(300, { timeoutMs: 120000 });
    const cartX = await mc.entityNum('@e[type=minecart,tag=ir_cart,limit=1]', 'Pos[0]');
    ok(cartX > cartX0 + 30, `pace cart should roll east (moved ${(cartX - cartX0).toFixed(1)} blocks in 300 ticks)`);
    const seatX = await mc.entityNum('@e[type=item_display,tag=ir_seat,limit=1]', 'Pos[0]');
    const camAhead = (await mc.score('.PACE_CART_BEHIND', 'cfg_ride')) - (await mc.score('.RIDER_BEHIND', 'cfg_camera'));
    closeTo(seatX - cartX, camAhead, 2.5, 'rig rides (.PACE_CART_BEHIND - .RIDER_BEHIND) blocks ahead of the pace cart');
    note(`cart ${cartX0.toFixed(1)} -> ${cartX.toFixed(1)}, seat ${seatX.toFixed(1)}`);
  });

  test('camera seat height follows the recorded profile', async ({ mc }) => {
    const seatX = await mc.entityNum('@e[type=item_display,tag=ir_seat,limit=1]', 'Pos[0]');
    const seatY = await mc.entityNum('@e[type=item_display,tag=ir_seat,limit=1]', 'Pos[1]');
    const base = await mc.score('.trackBase', 'ir');
    const idx = Math.min(await mc.trackLen() - 1, Math.max(0, Math.floor(seatX) - base));
    const lineY = await mc.trackY(idx);
    const lift = (await mc.score('.CAMLIFT', 'cfg_camera')) / 10;
    const height = (await mc.score('.CAMHEIGHT', 'cfg_camera')) / 10;
    between(seatY - lineY, -1.5, lift + height + 2.5, `seat Y ${seatY} vs rail line Y ${lineY}`);
  });

  test('ride cart is glued onto the camera seat by the keeper', async ({ mc }) => {
    const r = await mc.cmd('data get entity @e[type=item_display,tag=ir_seat,limit=1] Passengers[0].Tags');
    includes(r, 'ir_ride', 'seat carries the ride cart as passenger');
  });

  test('builder keeps the head within .PACE_CART_BEHIND of the cart', async ({ mc }) => {
    const gap = await mc.score('.gap', 'ir');
    const ahead = await mc.score('.PACE_CART_BEHIND', 'cfg_ride');
    const maxTick = await mc.score('.BUILD_PER_TICK', 'cfg_ride');
    between(gap, 1, ahead + maxTick, `.gap (${gap}) must stay within .PACE_CART_BEHIND (${ahead})`);
  });

  test('chunk pipeline healthy: head never went missing', async ({ mc }) => {
    eq(await mc.score('.hdmiss', 'ir'), 0, 'head marker stayed selectable (no incoherent pauses)');
    // The forceload macro ends with `return run` on its add, so the health
    // signal is meaningful on modern store-success semantics: a ride that
    // rolled chunks must have read success (and never armed the warning).
    eq(await mc.score('.flok', 'ir'), 1, 'forceload health signal reads success (.flok)');
    eq(await mc.score('.flwarn', 'ir'), 0, 'the broken-forceload warning never armed (.flwarn)');
  });

  test('no unexpected server errors during the ride', async ({ mc, server }) => {
    await mc.fn('stop');
    await mc.cmd(`kill @e[type=armor_stand,tag=${SURROGATE_TAG}]`);
    const errs = server.errorsSince(0, { alsoIgnore: [/Failed to load function/] });
    eq(errs.length, 0, `unexpected ERROR lines: ${errs.slice(0, 5).join(' | ')}`);
  });
});
