// Surrogate-rider helpers: start a real ride headlessly.
//
// `begin` runs `as` whatever entity we hand it -- only the player-specific
// steps (recipe toast, the rig summons in launch_done, the mount) silently
// no-op for a non-player. Everything else -- the anchor, the runway
// pre-build, the pace cart, the per-tick build loop, chunk rolling, torch
// scatter and the track history -- runs exactly as it would for a player,
// so an armor stand makes the whole build pipeline testable on a server
// with no client attached. We summon the camera rig (ir_seat + ir_ride)
// ourselves afterwards; the per-tick keepers glue it together just as they
// do after a player launch.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const SURROGATE_TAG = 'ir_test_rider';

/** Place the surrogate rider at (x, z), on loaded ground. */
export async function placeSurrogate(mc, { x = 0.5, z = 0.5 } = {}) {
  await mc.cmd(`kill @e[type=armor_stand,tag=${SURROGATE_TAG}]`);
  await mc.loadRegion(Math.floor(x) - 16, Math.floor(z) - 16, Math.floor(x) + 16, Math.floor(z) + 16, { settleMs: 1200 });
  await mc.cmd(`summon minecraft:armor_stand ${x} 250 ${z} {Tags:["${SURROGATE_TAG}"],NoGravity:1b,Invisible:1b}`);
  if (!(await mc.entityExists(`@e[type=armor_stand,tag=${SURROGATE_TAG},limit=1]`))) {
    throw new Error('surrogate rider did not spawn (chunk not loaded?)');
  }
}

/** Run begin as the surrogate. Returns immediately with .started == 2. */
export async function beginRide(mc) {
  const r = await mc.cmd(`execute as @e[type=armor_stand,tag=${SURROGATE_TAG},limit=1] at @s align xz run function infinite_rail:begin`);
  if (!/Running function/.test(r)) throw new Error(`begin did not run: ${JSON.stringify(r)}`);
}

/** Wait for launch_tick -> launch_done to finish (.started == 1). */
export async function awaitLaunched(mc, { timeoutMs = 120000 } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const s = await mc.score('.started', 'ir');
    if (s === 1) return;
    if (s === 0) throw new Error('ride stopped while waiting for launch');
    await sleep(500);
  }
  throw new Error(`launch did not complete within ${timeoutMs / 1000}s (started=${await mc.score('.started', 'ir')})`);
}

/** placeSurrogate + beginRide + awaitLaunched, returning the ride anchor. */
export async function startRide(mc, opts = {}) {
  await placeSurrogate(mc, opts);
  await beginRide(mc);
  const trackBase = await mc.score('.trackBase', 'ir');
  const railY0 = await mc.score('.railY', 'ir');
  if (opts.awaitLaunch !== false) await awaitLaunched(mc, opts);
  return { trackBase, railY0 };
}

/**
 * Summon the camera rig a player launch would have created (launch_done
 * only summons it at a real player). main's keepers mount ride-cart onto
 * seat every tick, and cam_follow starts flying the seat immediately.
 */
export async function summonRig(mc) {
  await mc.cmd('kill @e[type=item_display,tag=ir_seat]');
  await mc.cmd('kill @e[type=minecart,tag=ir_ride]');
  await mc.cmd('execute at @e[type=minecart,tag=ir_cart,limit=1] run summon minecraft:item_display ~ ~1 ~ {Tags:["ir_seat"],teleport_duration:1}');
  await mc.cmd('execute at @e[type=minecart,tag=ir_cart,limit=1] run summon minecraft:minecart ~ ~1 ~ {Tags:["ir_ride"],Invulnerable:1b,Rotation:[90f,0f]}');
}

export async function stopRide(mc) {
  await mc.fn('stop');
  await mc.cmd(`kill @e[type=armor_stand,tag=${SURROGATE_TAG}]`);
}

/** Read n evenly-spaced consecutive index pairs from the track history. */
export async function trackPairSamples(mc, len, n = 20) {
  const pairs = [];
  const stride = Math.max(1, Math.floor((len - 2) / n));
  for (let i = 0; i + 1 < len; i += stride) {
    const y0 = await mc.trackY(i);
    const y1 = await mc.trackY(i + 1);
    pairs.push({ i, y0, y1 });
  }
  return pairs;
}

/**
 * Physically verify one column: powered rail at (x, y), redstone-block
 * support below it, light block 3 above. Region must be loaded.
 */
export async function checkColumn(mc, x, y, z) {
  return {
    rail: await mc.blockIs(x, y, z, 'minecraft:powered_rail'),
    support: await mc.blockIs(x, y - 1, z, 'minecraft:redstone_block'),
    light: await mc.blockIs(x, y + 3, z, 'minecraft:light'),
  };
}
