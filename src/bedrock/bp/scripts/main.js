// =============================================================================
//  INFINITE RAIL - Bedrock Edition Script API port
//
//  This file is the Bedrock-native half of the hybrid architecture (see
//  CONTEXT.md section 11). The Java data pack and this script share ONE brain:
//  the event-model state machine in src/shared/functions (config, decide,
//  consider_start, start_event, end_event), which lives in the scoreboard and
//  runs as .mcfunction on both editions. Everything around that brain -- data
//  gathering, heavy math, engine plumbing -- is implemented natively per
//  edition, and this file is the Bedrock implementation:
//
//    Java jank (why it existed)                ->  Bedrock native replacement
//    -------------------------------------------------------------------------
//    ir_probe marker + "positioned over"       ->  dimension.getTopmostBlock()
//      (only way to read heightmaps into
//       scoreboards)
//    storage infinite_rail:track y + cam_get   ->  plain JS array (trackY),
//      macro (only array vanilla Java has)         trimmed + persisted
//    build_loop <-> build_step recursion       ->  a JS while loop
//      (mcfunction has no loops)
//    fixed-point milliblock scoreboard math    ->  ordinary doubles
//      (scoreboards are int-only)
//    ir_seat item_display + teleport_duration  ->  ir_seat CUSTOM ENTITY (this
//      + cam_tp macro (client interpolation)       pack's BP+RP: invisible, no
//                                                  gravity, no collision) that
//                                                  the ride cart RIDES, moved
//                                                  by per-tick velocity (which
//                                                  Bedrock clients interpolate,
//                                                  unlike teleports) + optional
//                                                  native Camera API mode
//    hidden pace cart + plug + stall keeper    ->  a virtual pace position
//      (only way to get real rail pace and         advanced by scripted speed
//       drive it via the max-speed gamerule)       with smooth acceleration
//    "execute if biome" + chunk counters       ->  dimension.getBiome()
//    forceload macro                           ->  /tickingarea (two leapfrog
//                                                  named areas)
//
//  The per-column pipeline is IDENTICAL to Java's advance.mcfunction:
//    1. sampleWindow() -> average surface of the next 48 blocks (12 samples,
//       clamped +/-UPCLAMP/DOWNCLAMP, void reads fall back to the average)
//    2. target = avg + HOVER  ->  written to the scoreboard
//    3. "function infinite_rail/decide"  (the SHARED brain; reads .target and
//       .railY, keeps .slope/.flat/.lastDir, answers with .dir)
//    4. place the column per .dir (carve, redstone support, rail, light)
//    5. append railY to the track history (the camera's map of the path)
//    6. every 16 blocks: rollChunks()
//
//  Scoreboard names: the shared functions use #NAME fake players on Java; the
//  build rewrites them to .NAME for Bedrock ('.' is the proven-safe fake-player
//  prefix on Bedrock's command parser), so this script addresses them as
//  '.NAME' strings via the native scoreboard API.
//
//  The camera math in camFollow()/lifted() is a floating-point port of
//  cam_follow/cam_blend/cam_scan/cam_sample.mcfunction -- same construction,
//  same knobs, none of the milliblock fixed-point scaffolding. See CONTEXT.md
//  section 7g for the algorithm itself.
// =============================================================================

import { world, system, BlockPermutation, BlockVolume, EasingType, GameMode } from '@minecraft/server';
import { camHeight } from './cam_math.js';

// --- Constants ---------------------------------------------------------------

const NS = 'infinite_rail';
const OBJ = 'ir';
const P = '.'; // fake-player prefix ('#' on Java; '.' survives Bedrock's parser)
const TAG_RIDE = 'ir_ride';
const TAG_SEAT = 'ir_seat';
// The invisible camera seat -- a custom entity from this pack's BP+RP pair
// (no gravity, no collision, rideable by minecarts). The ride cart is its
// permanent PASSENGER, exactly like Java's item_display seat: passengers run
// no physics of their own, so the cart can never be captured by the powered
// rails under it, dragged by gravity, or bounced by ground contact -- the
// engine fighting the script over the cart was what made the ride bob
// vertically. The script only ever moves the seat.
const SEAT_TYPE = 'infinite_rail:seat';
const AREA_A = 'ir_area_a';
const AREA_B = 'ir_area_b';
const PREFIX = '§6[Infinite Rail]§r ';
const DBG = '§3[IR debug]§r ';

// How fast the virtual pace position eases between speed targets, in
// blocks/second per tick. Java gets its acceleration for free from powered-rail
// physics; this reproduces a similar gentle ramp (8 -> 32 blocks/s in ~3 s).
const ACCEL = 0.4;

// The ride cart rests this far above the smoothed rail line, like a real cart
// on a rail (Java uses the same 62 milliblocks in cam_move).
const CART_REST = 0.062;

// In-memory track history is trimmed behind the ride so an endless ride can't
// grow memory forever (an improvement over Java's ever-growing storage list;
// the camera only ever reads a few hundred columns around the rig).
const HIST_MAX = 2048;
// How many trailing history entries are persisted for seamless world rejoins.
const HIST_PERSIST = 1024;

// Everything the shared config.mcfunction sets, with its default, so the
// script can survive a wiped scoreboard and knows what to read. Values are
// re-read from the scoreboard every tick, so live "/scoreboard players set
// .HOVER ir 8" tweaks work mid-ride exactly like Java.
const CONFIG_DEFAULTS = {
  HOVER: 2, TUNNEL: 6, CAMHEIGHT: 0, CAMBLEND: 6, CAMSMOOTH: 6, CAMLIFT: 20,
  CAMAHEAD: 64, CAMMODE: 0, AUTOSTART: 1, MAXSPEED: 8, OCEANSPEED: 32,
  OCEANCHUNKS: 6, LANDCHUNKS: 4, DEADBAND: 3, SAMEGAP: 25, TURNGAP: 40,
  UPCLAMP: 150, DOWNCLAMP: 50, AHEAD: 224, GENAHEAD: 192, MAXTICK: 15,
  DEBUGMODE: 0,
};

// The vanilla ocean biomes (Bedrock has no biome tags, so #minecraft:is_ocean
// becomes an explicit id set; deep_warm_ocean exists only on Bedrock).
const OCEAN_BIOMES = new Set([
  'minecraft:ocean', 'minecraft:deep_ocean',
  'minecraft:warm_ocean', 'minecraft:deep_warm_ocean',
  'minecraft:lukewarm_ocean', 'minecraft:deep_lukewarm_ocean',
  'minecraft:cold_ocean', 'minecraft:deep_cold_ocean',
  'minecraft:frozen_ocean', 'minecraft:deep_frozen_ocean',
  'minecraft:legacy_frozen_ocean',
]);

// Column block palette (resolved once; golden_rail is Bedrock's powered rail;
// rail_direction: 1 = flat east-west, 2 = ascending east, 3 = ascending west;
// the light block is per-level flattened on current Bedrock).
let AIR, RAIL_FLAT, RAIL_UP, RAIL_DOWN, SUPPORT;
const LIGHT_BLOCK = 'minecraft:light_block_11';

// --- Ride state ----------------------------------------------------------------
// The Bedrock twin of Java's scoreboard runtime state (section 4.1 of
// CONTEXT.md), except that the event-model variables (.slope/.flat/.lastDir/
// .dir/...) deliberately do NOT appear here: they belong to the shared
// .mcfunction brain and live only in the scoreboard.

const S = {
  started: false,
  autodone: false,
  headX: 0,        // #headX -- world X of the build front (last built column)
  railY: 0,        // #railY -- current rail elevation
  centerZ: 0,      // the track's fixed Z centerline (block coordinate)
  avg: 0,          // #avg -- rolling average of the terrain surface
  nextLoad: 0,     // #nextLoad -- headX at which rollChunks() next fires
  trackBase: 0,    // #trackBase -- world X of trackY[0]
  trackY: [],      // storage infinite_rail:track y -- one rail Y per column
  paceX: 0,        // the VIRTUAL pace cart's X (replaces ir_cart; double)
  paceSpeed: 0,    // its current speed in blocks/tick (double)
  targetSpeed: 0,  // blocks/tick it is easing toward
  fast: false,     // #fast -- ocean cruising mode active
  oceanRun: 0,     // #oceanRun -- consecutive ocean chunks
  landRun: 0,      // #landRun -- consecutive non-ocean chunks
  lastChunk: 0,    // #lastChunk -- last chunk index the ocean check processed
  s2: 0,           // #s2 -- the reactive descent chaser (blocks; double)
  riderName: '',   // the one player this ride belongs to
  startTimer: 0,   // auto-start countdown (ticks with a player present)
  cartId: '',      // entity id of the ride cart (rediscovered by tag if stale)
  seatId: '',      // entity id of the camera seat (rediscovered by tag if stale)
  rigMissing: 0,   // consecutive ticks the rig has been missing (respawn grace)
  camActive: false, // whether the optional Camera API mode is currently applied
  teleportFallback: false, // set if applyImpulse is unavailable on the seat
};

let dim = null;   // the overworld
let inited = false;
let saveCountdown = 0;
// Bumped by every begin() and stop(): a begin() in its async chunk-wait phase
// aborts if a newer begin/stop superseded it, so a stale poll can never
// resurrect a canceled ride.
let lifecycleGen = 0;

// --- Small helpers -----------------------------------------------------------

function objective() {
  return world.scoreboard.getObjective(OBJ) ?? world.scoreboard.addObjective(OBJ);
}

function getScore(name, fallback) {
  const v = objective().getScore(P + name);
  return v === undefined ? fallback : v;
}

function setScore(name, value) {
  objective().setScore(P + name, value | 0);
}

function cfg(name) {
  return getScore(name, CONFIG_DEFAULTS[name]);
}

function runCmd(command) {
  try { return dim.runCommand(command); } catch { return undefined; }
}

function say(msg) { world.sendMessage(PREFIX + msg); }
function dbg(msg) { if (cfg('DEBUGMODE') === 1) world.sendMessage(DBG + msg); }

function findRider() {
  if (!S.riderName) return undefined;
  return world.getAllPlayers().find((p) => p.name === S.riderName);
}

// Find the one live entity wearing our tag, REMOVING any duplicates: rejoin
// races (a replacement spawned before the original's chunk loaded back in)
// and stale sessions can leave extras behind, and an untracked cart would
// keep drifting around the line forever.
function findTagged(type, tag, preferId) {
  let tagged;
  try { tagged = dim.getEntities({ type, tags: [tag] }); } catch { return undefined; }
  const keep = tagged.find((e) => e.id === preferId && e.isValid)
    ?? tagged.find((e) => e.isValid);
  for (const e of tagged) {
    if (e !== keep) {
      try { e.getComponent('minecraft:rideable')?.ejectRiders(); } catch { /* none */ }
      try { e.remove(); } catch { /* already gone */ }
    }
  }
  return keep;
}

function findCart() {
  const cart = findTagged('minecraft:minecart', TAG_RIDE, S.cartId);
  if (cart) S.cartId = cart.id;
  return cart;
}

function findSeat() {
  const seat = findTagged(SEAT_TYPE, TAG_SEAT, S.seatId);
  if (seat) S.seatId = seat.id;
  return seat;
}

function chunkLoaded(x, z) {
  // getBlock is documented to return undefined for unloaded chunks, which
  // makes it the most portable "is this column ready" probe.
  try { return dim.getBlock({ x, y: 100, z }) !== undefined; } catch { return false; }
}

// --- Persistence ---------------------------------------------------------------
// Java keeps everything in the scoreboard / command storage, which the save
// file persists for free. The scoreboard half (the shared brain's state) still
// persists for free on Bedrock; this persists the script half so a ride
// survives quitting and rejoining the world mid-journey.

function saveState() {
  const histStart = Math.max(0, S.trackY.length - HIST_PERSIST);
  world.setDynamicProperty('ir:state', JSON.stringify({
    started: S.started, autodone: S.autodone,
    headX: S.headX, railY: S.railY, centerZ: S.centerZ, avg: S.avg,
    nextLoad: S.nextLoad, trackBase: S.trackBase + histStart,
    trackY: S.trackY.slice(histStart),
    paceX: S.paceX, paceSpeed: S.paceSpeed, targetSpeed: S.targetSpeed,
    fast: S.fast, oceanRun: S.oceanRun, landRun: S.landRun,
    lastChunk: S.lastChunk, s2: S.s2, riderName: S.riderName,
  }));
}

function loadState() {
  const raw = world.getDynamicProperty('ir:state');
  if (typeof raw !== 'string') return;
  try {
    const d = JSON.parse(raw);
    S.started = !!d.started; S.autodone = !!d.autodone;
    S.headX = d.headX | 0; S.railY = d.railY | 0; S.centerZ = d.centerZ | 0;
    S.avg = d.avg | 0; S.nextLoad = d.nextLoad | 0; S.trackBase = d.trackBase | 0;
    S.trackY = Array.isArray(d.trackY) ? d.trackY : [];
    S.paceX = +d.paceX || 0; S.paceSpeed = +d.paceSpeed || 0;
    S.targetSpeed = +d.targetSpeed || 0; S.fast = !!d.fast;
    S.oceanRun = d.oceanRun | 0; S.landRun = d.landRun | 0;
    S.lastChunk = d.lastChunk | 0; S.s2 = +d.s2 || 0;
    S.riderName = typeof d.riderName === 'string' ? d.riderName : '';
  } catch { /* corrupt state: fall through to a fresh start */ }
}

// --- Terrain sampling ----------------------------------------------------------
// The Bedrock-native replacement for the ir_probe marker + "execute positioned
// over motion_blocking_no_leaves" trick: getTopmostBlock, then walk down past
// anything that wouldn't register on Java's motion_blocking_no_leaves heightmap
// (leaves and collision-less foliage; liquids DO count, so oceans read as sea
// level and get bridged). Returns the Y one above the surface block -- the same
// convention as the Java heightmap -- or undefined for void/unloaded reads.

function surfaceY(x, z) {
  let block;
  try { block = dim.getTopmostBlock({ x, z }); } catch { return undefined; }
  for (let i = 0; block && i < 48; i++) {
    if (block.isLiquid) return block.y + 1;
    if (!block.typeId.includes('leaves') && block.isSolid) return block.y + 1;
    try { block = dim.getTopmostBlock({ x, z }, block.y - 1); } catch { return undefined; }
  }
  return undefined;
}

// sample_window.mcfunction: 12 surface samples at +4..+48 blocks east of the
// head, each clamped to [avg-DOWNCLAMP, avg+UPCLAMP] around the previous
// average, summed and floor-divided by 12 (scoreboard division semantics).
function sampleWindow() {
  const lo = S.avg - cfg('DOWNCLAMP');
  const hi = S.avg + cfg('UPCLAMP');
  let sum = 0;
  for (let off = 4; off <= 48; off += 4) {
    let s = surfaceY(S.headX + off, S.centerZ);
    if (s === undefined || s <= -63) s = S.avg; // void / ungenerated: discard
    if (s < lo) s = lo;
    if (s > hi) s = hi;
    sum += s;
  }
  S.avg = Math.floor(sum / 12);
}

// --- Column placement ----------------------------------------------------------
// place_flat / place_up / place_down + carve + support, in native block API
// calls. Same order as Java: carve the bore first, then the support (the rail
// needs it to exist), then the rail, then the light.
//
// One documented visual difference from Java: Bedrock has no block_display
// entities, so the redstone power block under the rail is NOT disguised as
// smooth stone. It still powers the rail, survives water and emits no light.

function placeColumn(x, y, dir) {
  const z = S.centerZ;
  const carveH = dir === 0 ? cfg('TUNNEL') : cfg('TUNNEL') + 1; // #TUNNELUP
  dim.fillBlocks(
    new BlockVolume({ x, y, z: z - 1 }, { x, y: y + carveH, z: z + 1 }),
    AIR, { ignoreChunkBoundErrors: true },
  );
  dim.setBlockPermutation({ x, y: y - 1, z }, SUPPORT);
  dim.setBlockPermutation({ x, y, z }, dir === 0 ? RAIL_FLAT : dir === 1 ? RAIL_UP : RAIL_DOWN);
  dim.setBlockType({ x, y: y + 3, z }, LIGHT_BLOCK);
}

// --- The build loop ------------------------------------------------------------
// build_loop/build_step's bounded recursion, as the JS loop it was emulating.
// advance() is one column: sample -> SHARED decide -> place -> record history.

function advance() {
  sampleWindow();
  const target = S.avg + cfg('HOVER');

  // Hand the boiled-down state to the shared .mcfunction brain and read back
  // this column's direction. Everything else decide/consider_start/start_event/
  // end_event touch (.slope, .flat, .lastDir, .want, .need, ...) stays inside
  // the scoreboard, exactly as on Java.
  setScore('target', target);
  setScore('railY', S.railY);
  dim.runCommand(`function ${NS}/decide`);
  const dir = getScore('dir', 0);

  const colX = S.headX + 1;
  if (dir === -1) {
    S.railY -= 1;                    // descend: the rail sits one lower,
    placeColumn(colX, S.railY, -1);  // sloping up toward the west behind it
  } else if (dir === 1) {
    placeColumn(colX, S.railY, 1);   // climb: ascending rail at the current
    S.railY += 1;                    // level, then the line steps up
  } else {
    placeColumn(colX, S.railY, 0);
  }
  S.headX = colX;

  S.trackY.push(S.railY);
  if (S.trackY.length > HIST_MAX + 256) {
    const drop = S.trackY.length - HIST_MAX;
    S.trackY.splice(0, drop);
    S.trackBase += drop;
  }

  if (S.headX >= S.nextLoad) rollChunks();
}

// A column may only be built once its OWN chunk and its entire 48-block
// sample window are loaded/generated. This is the load-bearing guard for
// terrain-following: deciding a column while the lookahead is unloaded would
// read every sample as "no data", leave the rolling average frozen, and bake
// a permanently flat line into the world. Better to pause and keep the data
// honest -- the pace cap already slows the ride while the head waits.
function buildReady() {
  for (let off = 1; off <= 49; off += 16) {
    if (!chunkLoaded(S.headX + off, S.centerZ)) return false;
  }
  return true;
}

let stallTicks = 0;
let stallWarned = false;

function buildLoop() {
  let budget = cfg('MAXTICK');
  const ahead = cfg('AHEAD');
  let built = false;
  while (budget > 0 && S.headX - Math.floor(S.paceX) < ahead) {
    if (!buildReady()) break;
    budget -= 1;
    try { advance(); } catch (e) { dbg(`build error at x=${S.headX + 1}: ${e}`); break; }
    built = true;
  }
  // If the builder is starved for terrain while the track buffer is running
  // low, say so once -- the likeliest cause is ticking areas not generating
  // chunks ahead (the ride then follows the player's own chunk loading).
  if (!built && S.headX - Math.floor(S.paceX) < ahead - 64) {
    stallTicks += 1;
    if (stallTicks === 200 && !stallWarned) {
      stallWarned = true;
      say('§eTerrain ahead is generating slowly; the ride will ease off until it catches up. Set §b.DEBUGMODE§e to 1 for corridor status.');
    }
  } else {
    stallTicks = 0;
  }
}

// --- Chunk management ----------------------------------------------------------
// roll_chunks/forceload: every 16 blocks of head travel, re-lay a ticking-area
// corridor and roll the world spawn + respawn points forward with the ride.
// The corridor reaches from behind the RIG (the rig trails the head by up to
// #AHEAD - #CAMAHEAD blocks, and its chunk must stay ticked for the cart) out
// to #GENAHEAD ahead of the head. Bedrock allows 10 named ticking areas of up
// to 100 chunks each; two alternating names leapfrog so coverage never gaps
// while one is being moved (with defaults the corridor is (192+192+32)/16 x 3
// ~= 78 chunks -- inside the per-area cap).

let areaFlip = false;

function rollChunks() {
  const gen = cfg('GENAHEAD');
  const back = Math.max(32, cfg('AHEAD') - cfg('CAMAHEAD') + 32);
  const x = S.headX, y = S.railY, z = S.centerZ;
  const name = areaFlip ? AREA_A : AREA_B;
  areaFlip = !areaFlip;
  runCmd(`tickingarea remove ${name}`);
  const added = runCmd(`tickingarea add ${x - back} 0 ${z - 8} ${x + gen} 0 ${z + 8} ${name}`);
  runCmd(`setworldspawn ${x} ${y + 1} ${z}`);
  runCmd(`spawnpoint @a ${x} ${y + 1} ${z}`);
  S.nextLoad += 16;
  if (cfg('DEBUGMODE') === 1) {
    const probes = [32, 96, gen]
      .map((d) => `+${d}:${chunkLoaded(x + d, z) ? '§aloaded§7' : '§cnot yet§7'}`)
      .join(' ');
    dbg(`corridor rolled at x=${x} (add ${added ? 'ok' : '§cFAILED§7'}); ahead ${probes}`);
  }
}

// --- Ocean speed-up ------------------------------------------------------------
// ocean_check/speed_up/speed_down. Java drives the minecart max-speed gamerule
// and lets rail physics do the rest; that gamerule doesn't exist on Bedrock, so
// the virtual pace speed is steered directly (targetSpeed, eased by ACCEL in
// tickPace) -- same trigger logic, same knobs, same per-chunk cadence.

function oceanCheck() {
  const rigX = S.paceX + cfg('CAMAHEAD');
  const chunkNow = Math.floor(rigX / 16);
  if (chunkNow === S.lastChunk) return;
  S.lastChunk = chunkNow;

  let isOcean = false;
  try {
    const cart = findCart();
    const loc = cart?.isValid ? cart.location : { x: rigX, y: S.railY, z: S.centerZ };
    isOcean = OCEAN_BIOMES.has(dim.getBiome(loc).id);
  } catch { /* unloaded chunk: count as land, like Java's failed biome check */ }

  if (isOcean) {
    S.oceanRun += 1;
    S.landRun = 0;
    if (S.oceanRun <= cfg('OCEANCHUNKS')) {
      dbg(`§bocean chunk - oceanRun=§f${S.oceanRun}§b/§f${cfg('OCEANCHUNKS')}§7  speed=§f${(S.paceSpeed * 20).toFixed(1)}`);
    }
    if (cfg('OCEANSPEED') >= 1 && S.oceanRun >= cfg('OCEANCHUNKS')) {
      // speed_up: re-asserted every ocean chunk so the configured speed always
      // wins; the debug line and flag flip only fire on the transition.
      S.targetSpeed = cfg('OCEANSPEED') / 20;
      if (!S.fast) dbg(`§bswitching to fast ocean mode, speed §f${cfg('OCEANSPEED')}`);
      S.fast = true;
    }
  } else {
    S.landRun += 1;
    S.oceanRun = 0;
    if (S.landRun <= cfg('LANDCHUNKS')) {
      dbg(`§eland chunk - landRun=§f${S.landRun}§e/§f${cfg('LANDCHUNKS')}§7  speed=§f${(S.paceSpeed * 20).toFixed(1)}`);
    }
    if (S.fast && S.landRun >= cfg('LANDCHUNKS')) {
      // speed_down: restored once on the transition back to land.
      S.targetSpeed = cfg('MAXSPEED') / 20;
      dbg(`§eslowing down over land, speed §f${cfg('MAXSPEED')}`);
      S.fast = false;
    }
  }
}

// The virtual pace cart: eases toward the target speed and rolls east. This is
// what the hidden physical pace cart + always-powered rails + stall keeper +
// max-speed gamerule achieved on Java, in four lines.
function tickPace() {
  if (!S.fast) S.targetSpeed = cfg('MAXSPEED') / 20; // land speed stays live-tweakable
  const accel = ACCEL / 20;
  // Never let the ride outrun the built track (e.g. while world generation is
  // catching up). This is a SOFT ceiling: the allowed speed shrinks smoothly
  // with the remaining track buffer, so a starved builder reads as the ride
  // gently easing off -- a hard positional clamp here made the cart surge and
  // jerk whenever the buffer ran low at ocean speed.
  const headroom = (S.headX - cfg('CAMAHEAD') - 8) - S.paceX;
  const allowed = Math.max(0, Math.min(S.targetSpeed, headroom / 40));
  if (S.paceSpeed < allowed) S.paceSpeed = Math.min(allowed, S.paceSpeed + accel);
  else if (S.paceSpeed > allowed) S.paceSpeed = Math.max(allowed, S.paceSpeed - accel * 2);
  S.paceX += S.paceSpeed;
}

// --- The smooth camera ---------------------------------------------------------
// The height construction itself lives in cam_math.js (shared with the
// tools/simulate.mjs regression test, so the shipped math is what gets
// tested); this wrapper derives the rig's column index and fraction from the
// pace position, exactly like cam_follow.mcfunction does from the pace cart.

function camFollow() {
  if (S.trackY.length === 0) return undefined;
  const maxi = S.trackY.length - 1;
  const fx = S.paceX - Math.floor(S.paceX);
  let ci = Math.floor(S.paceX) - S.trackBase + cfg('CAMAHEAD');
  ci = Math.min(Math.max(ci, 0), maxi);

  const r = camHeight({
    trackY: S.trackY, index: ci, fx,
    lift10: cfg('CAMLIFT'), blend: cfg('CAMBLEND'), smooth: cfg('CAMSMOOTH'),
    s2: S.s2,
  });
  S.s2 = r.s2;
  return r.sy;
}

// cam_move: fly the rig -- the seat, and with it the cart riding it and the
// player riding the cart -- to CAMAHEAD blocks east of the pace position at
// the smoothed height. The seat is driven by velocity: Bedrock clients
// interpolate physics motion smoothly, where per-tick teleports strobe at
// 20 fps; and because the seat has no gravity or collision, the commanded
// motion is exactly the motion that happens (nothing fights the control
// loop). A drift catch teleports it back if anything knocks it far off.
function camMove(seat, sy) {
  const target = {
    x: S.paceX + cfg('CAMAHEAD'),
    y: sy + CART_REST + cfg('CAMHEIGHT') / 10,
    z: S.centerZ + 0.5,
  };
  const pos = seat.location;
  const d = { x: target.x - pos.x, y: target.y - pos.y, z: target.z - pos.z };
  const drift = Math.abs(d.x) + Math.abs(d.y) + Math.abs(d.z);
  if (drift > 4 || S.teleportFallback) {
    try { seat.teleport(target, { keepVelocity: false }); } catch { /* unloaded */ }
  } else {
    try {
      seat.clearVelocity();
      seat.applyImpulse(d);
    } catch {
      S.teleportFallback = true; // applyImpulse unsupported here: teleport from now on
    }
  }

  // Optional native Camera API mode (.CAMMODE 1): an eased minecraft:free
  // camera riding at eye height above the cart. Rotation is passed through
  // from the player every tick -- the free preset does not follow look input
  // by itself -- which trades a beat of look latency for extra glide.
  const rider = findRider();
  if (!rider) return;
  if (cfg('CAMMODE') === 1) {
    const rot = rider.getRotation();
    rider.camera.setCamera('minecraft:free', {
      location: { x: target.x, y: target.y + 1.2, z: target.z },
      rotation: { x: rot.x, y: rot.y },
      easeOptions: { easeTime: 0.15, easeType: EasingType.Linear },
    });
    S.camActive = true;
  } else if (S.camActive) {
    try { rider.camera.clear(); } catch { /* already cleared */ }
    S.camActive = false;
  }
}

// Spawn the two-piece rig at a position: the invisible seat and the ride cart
// mounted on it. Returns the seat (the mover), or throws if the chunk isn't
// ready. Any prior rig pieces are removed first so this can never duplicate.
function spawnRig(pos) {
  const oldSeat = findSeat();
  if (oldSeat) { try { oldSeat.remove(); } catch { /* gone */ } }
  const oldCart = findCart();
  if (oldCart) { try { oldCart.remove(); } catch { /* gone */ } }
  S.seatId = '';
  S.cartId = '';

  const seat = dim.spawnEntity(SEAT_TYPE, pos);
  seat.addTag(TAG_SEAT);
  S.seatId = seat.id;

  let cart;
  try {
    cart = dim.spawnEntity('minecraft:minecart', pos, { initialRotation: -90 });
  } catch {
    cart = dim.spawnEntity('minecraft:minecart', pos);
  }
  cart.addTag(TAG_RIDE);
  S.cartId = cart.id;

  seat.getComponent('minecraft:rideable')?.addRider(cart);
  return seat;
}

// --- Keepers ---------------------------------------------------------------
// main.mcfunction's per-tick guards, minus everything the virtual pace cart
// made obsolete (plug, stall re-boost, pace-cart ejections). The ride cart
// holds exactly one seat, so while the rider is aboard nothing else can enter
// it and it can't scoop up mobs.

function keepers(seat, cart) {
  const rider = findRider();
  const rideable = cart.getComponent('minecraft:rideable');
  if (!rideable) return;

  // Keeper: the ride cart must always be the seat's passenger -- that is what
  // exempts it from its own minecart physics (rail capture, gravity, ground
  // bounce). Re-mount it if anything ever separates the two.
  if (!cart.getComponent('minecraft:riding')) {
    try {
      const sp = seat.location;
      const cp = cart.location;
      if (Math.abs(cp.x - sp.x) + Math.abs(cp.y - sp.y) + Math.abs(cp.z - sp.z) > 4) {
        cart.teleport({ x: sp.x, y: sp.y, z: sp.z });
      }
      seat.getComponent('minecraft:rideable')?.addRider(cart);
    } catch { /* seat momentarily invalid */ }
  }

  // Eject anything riding the cart that isn't the rider (possible only in the
  // brief window after a dismount).
  for (const r of rideable.getRiders()) {
    if (r.typeId !== 'minecraft:player') rideable.ejectRider(r);
  }

  if (!rider) return;

  // Re-mount a dismounted rider (sneak-dismounts, rejoins). Like Java, only
  // adventure-mode players are recaptured -- switching to creative is the
  // sanctioned way to leave the ride and wander off. A rider who ended up far
  // from the cart (e.g. respawned at the rolled spawnpoint after a rejoin) is
  // brought back to it first; players may be teleported freely while not
  // riding, and a normal sneak-dismount lands well inside the threshold.
  if (rider.getGameMode() === GameMode.Adventure && !rider.getComponent('minecraft:riding')) {
    try {
      const c = cart.location;
      const p = rider.location;
      if (Math.abs(p.x - c.x) + Math.abs(p.y - c.y) + Math.abs(p.z - c.z) > 8) {
        rider.teleport({ x: c.x, y: c.y + 1, z: c.z });
      }
      rideable.addRider(rider);
    } catch { /* different dimension etc. */ }
  }

  // Keep the rider's inventory empty: hides the held item/arm (Bedrock has no
  // /hud hand element -- hide_hand's job lands here) and stops item pickup.
  try {
    const inv = rider.getComponent('minecraft:inventory')?.container;
    if (inv && inv.emptySlotsCount < inv.size) inv.clearAll();
  } catch { /* container busy */ }
}

// --- Lifecycle ---------------------------------------------------------------

// begin.mcfunction. Runs over several ticks because ticking areas generate
// terrain asynchronously (Java's forceload behaves the same; its begin just
// tolerates air reads) -- so this seeds the state, then a short poller waits
// for the starting chunks before laying track and seating the rider.
function begin(player) {
  // The algorithm reads Overworld surface heightmaps; refuse elsewhere (the
  // Java pack documents the same Overworld-only limitation).
  if (player.dimension.id !== 'minecraft:overworld') {
    say('§cThe ride can only start in the Overworld.');
    return;
  }
  stop(true); // reset any previous run (silently)
  const gen = ++lifecycleGen;

  S.autodone = true;
  S.riderName = player.name;
  runCmd(`function ${NS}/setup_world`);

  const startX = Math.floor(player.location.x);
  S.centerZ = Math.floor(player.location.z);
  S.headX = startX;
  S.nextLoad = startX + 16;

  runCmd(`tickingarea remove ${AREA_A}`);
  runCmd(`tickingarea remove ${AREA_B}`);
  runCmd(`tickingarea add ${startX - 16} 0 ${S.centerZ - 8} ${startX + cfg('GENAHEAD')} 0 ${S.centerZ + 8} ${AREA_A}`);

  S.paceSpeed = 0;
  S.targetSpeed = cfg('MAXSPEED') / 20;
  S.fast = false;
  dbg(`default ride speed set to §f${cfg('MAXSPEED')}§7 blocks/s`);

  // Wait (up to ~50 s) for the ticking area to load/generate both the start
  // column and the rig position (startX + #CAMAHEAD, where the ride cart
  // spawns), then finish the launch. Ticking-area generation is asynchronous
  // with no guaranteed latency, so this polls rather than assuming a delay.
  let waited = 0;
  const poll = system.runInterval(() => {
    if (lifecycleGen !== gen) { system.clearRun(poll); return; } // superseded
    waited += 1;
    if (waited === 40) say('§7Still generating the starting terrain...');
    const ready = chunkLoaded(startX, S.centerZ)
      && chunkLoaded(startX + cfg('CAMAHEAD'), S.centerZ);
    if (!ready && waited < 200) return;
    system.clearRun(poll);
    beginPhase2(startX);
  }, 5);
}

// A launch that cannot finish must clean up after itself: remove the ticking
// areas it created and persist the state it already mutated (autodone stays
// latched, started stays false), so nothing is leaked and a fresh start
// command works. Java's begin() is synchronous and cannot abort half-way.
function abortLaunch(reason) {
  say(`§cRide start aborted: ${reason}`);
  runCmd(`tickingarea remove ${AREA_A}`);
  runCmd(`tickingarea remove ${AREA_B}`);
  saveState();
}

function beginPhase2(startX) {
  const player = findRider();
  if (!player) { abortLaunch('the starting player left.'); return; }

  // Initial rail elevation = terrain surface here + hover altitude.
  const surf = surfaceY(startX, S.centerZ);
  S.railY = (surf ?? Math.floor(player.location.y)) + cfg('HOVER');
  S.avg = S.railY - cfg('HOVER');

  // Initialize the shared brain's event-model state, exactly as begin does on
  // Java: flat, with a large flat-gap so the first slope is unrestricted.
  setScore('slope', 0);
  setScore('flat', 99);
  setScore('lastDir', 0);
  setScore('railY', S.railY);

  // Track history: one rail-Y per column; the camera's whole map of the path.
  S.trackY = [S.railY];
  S.trackBase = startX;

  // First column + the virtual pace cart parked on it.
  try { placeColumn(startX, S.railY, 0); } catch { /* still generating; loop heals it */ }
  S.paceX = startX + 0.5;
  S.lastChunk = Math.floor((S.paceX + cfg('CAMAHEAD')) / 16);
  S.oceanRun = 0;
  S.landRun = 0;

  // Pre-build past the rig position so the viewer starts on ready track.
  const preBudget = cfg('CAMAHEAD') + 32;
  for (let i = 0; i < preBudget; i++) {
    if (!buildReady()) break;
    try { advance(); } catch { break; }
  }

  // The camera rig: seat (invisible custom entity, the mover) -> ride cart
  // (real minecart, the seat's passenger, so it runs no physics of its own)
  // -> rider. The player mounts once (mount events flash the client's
  // un-hideable dismount hint, so the keeper only ever re-mounts after a
  // genuine dismount).
  S.s2 = S.railY;
  const sy = camFollow() ?? S.railY;
  const rigPos = {
    x: S.paceX + cfg('CAMAHEAD'),
    y: sy + CART_REST + cfg('CAMHEIGHT') / 10,
    z: S.centerZ + 0.5,
  };
  try {
    spawnRig(rigPos);
    const cart = findCart();
    cart?.getComponent('minecraft:rideable')?.addRider(player);
  } catch {
    // Rig chunk still not generated after the 50 s wait (or the player
    // portaled away mid-launch): give up cleanly instead of dying half-done.
    abortLaunch('the starting area is still generating -- run the start command again.');
    return;
  }

  // Spectator constraints: look freely, break nothing, feel nothing.
  try {
    player.runCommand('gamemode adventure @s');
    player.runCommand('effect @s resistance infinite 255 true');
    player.runCommand('effect @s saturation infinite 0 true');
  } catch { /* effects are belt-and-suspenders on top of the damage gamerules */ }

  S.started = true;
  saveState();
  say('§7Enjoy the ride.');
}

// stop.mcfunction: ends the ride and cleans up; the built track stays.
function stop(silent) {
  lifecycleGen += 1; // cancels any begin() still waiting on chunks
  S.started = false;
  const rider = findRider();
  if (rider) {
    try { rider.camera.clear(); } catch { /* not set */ }
    try { rider.runCommand('effect @s clear'); } catch { /* none */ }
  }
  S.camActive = false;
  // Remove EVERY rig piece wearing our tags (there should be one of each, but
  // stale sessions may have left extras behind).
  if (dim) {
    let pieces = [];
    try {
      pieces = [
        ...dim.getEntities({ type: SEAT_TYPE, tags: [TAG_SEAT] }),
        ...dim.getEntities({ type: 'minecraft:minecart', tags: [TAG_RIDE] }),
      ];
    } catch { /* entity type not registered: nothing to clean */ }
    for (const e of pieces) {
      try { e.getComponent('minecraft:rideable')?.ejectRiders(); } catch { /* empty */ }
      try { e.remove(); } catch { /* already gone */ }
    }
    runCmd(`tickingarea remove ${AREA_A}`);
    runCmd(`tickingarea remove ${AREA_B}`);
  }
  S.cartId = '';
  S.seatId = '';
  saveState(); // .autodone stays set: a stopped world never auto-restarts
  if (!silent) say('§7Ride stopped.');
}

// tick.mcfunction's auto-starter: in a fresh world, begin the ride for the
// first player to appear after a 5-second countdown. Once per world, ever.
function autoStart() {
  if (S.autodone || cfg('AUTOSTART') !== 1) return;
  const players = world.getAllPlayers();
  if (players.length === 0) return;
  S.startTimer += 1;
  if (S.startTimer === 1) say('§eStarting in 5...');
  else if (S.startTimer === 20) say('§eStarting in 4...');
  else if (S.startTimer === 40) say('§eStarting in 3...');
  else if (S.startTimer === 60) say('§eStarting in 2...');
  else if (S.startTimer === 80) say('§eStarting in 1...');
  else if (S.startTimer >= 100) begin(players[0]);
}

// --- Init + the tick driver ----------------------------------------------------

// Startup self-test of the script<->command scoreboard bridge that the whole
// hybrid design leans on. Two legs: (1) a score written via the native API
// must be readable and writable by commands under the same fake-player name;
// (2) the SHARED decide function must run via /function and answer through
// the scoreboard. If either leg fails, terrain-following cannot work -- say
// so loudly and specifically instead of silently building a flat line.
// Only runs when no ride is active (it exercises the brain's live state,
// snapshotting and restoring every score it touches).
function bridgeTest() {
  const touched = ['slope', 'flat', 'lastDir', 'target', 'railY', 'dir',
    'diff', 'slope0', 'want', 'need', 'ndead', 'nOne', 'bt'];
  const snap = {};
  for (const k of touched) snap[k] = objective().getScore(P + k);

  let legScores = false;
  let legBrain = false;
  try {
    setScore('bt', 41);
    runCmd(`scoreboard players add ${P}bt ir 1`);
    legScores = getScore('bt', -1) === 42;

    setScore('slope', 0);
    setScore('flat', 99);
    setScore('lastDir', 0);
    setScore('target', 100);
    setScore('railY', 90);
    setScore('dir', 0);
    runCmd(`function ${NS}/decide`);
    legBrain = getScore('dir', 0) === 1; // 10-block climb wanted -> dir must be 1
  } catch { /* reported below */ }

  for (const k of touched) {
    if (snap[k] === undefined) {
      try { objective().removeParticipant(P + k); } catch { /* never existed */ }
    } else {
      setScore(k, snap[k]);
    }
  }

  if (!legScores) {
    say('§cSELF-TEST FAILED: script-written scores are not visible to commands. The ride cannot follow terrain on this version -- please report this along with your Minecraft version.');
  } else if (!legBrain) {
    say('§cSELF-TEST FAILED: the shared decide function did not answer (the track would stay flat). Check the Content Log for errors loading infinite_rail functions and report this.');
  } else {
    dbg('bridge self-test OK (scores + shared decide)');
  }
}

function init() {
  dim = world.getDimension('overworld');
  objective();

  AIR = BlockPermutation.resolve('minecraft:air');
  RAIL_FLAT = BlockPermutation.resolve('minecraft:golden_rail', { rail_direction: 1, rail_data_bit: true });
  RAIL_UP = BlockPermutation.resolve('minecraft:golden_rail', { rail_direction: 2, rail_data_bit: true });
  RAIL_DOWN = BlockPermutation.resolve('minecraft:golden_rail', { rail_direction: 3, rail_data_bit: true });
  SUPPORT = BlockPermutation.resolve('minecraft:redstone_block');

  // Apply the tunable knobs from the SHARED config.mcfunction (the same file
  // Java runs from load.mcfunction). Editing config + /reload refreshes them
  // mid-ride, exactly like Java.
  const r = runCmd(`function ${NS}/config`);
  if (r === undefined) {
    say('§cconfig function failed to run -- using built-in defaults. Is the behavior pack fully installed?');
    for (const [k, v] of Object.entries(CONFIG_DEFAULTS)) {
      if (objective().getScore(P + k) === undefined) setScore(k, v);
    }
  }

  loadState();
  if (!S.started) bridgeTest();
  if (S.started) say('§7Ride resumed. Run §b/function infinite_rail/stop§7 to end it.');
  else say('§7Loaded. A fresh world starts the ride automatically; run §b/function infinite_rail/start§7 to (re)start it here.');
  inited = true;
}

// init() is called from worldLoad, but also lazily from the tick driver and
// the command bridge below: after a /reload the script module re-evaluates
// without a fresh worldLoad event, and the ride must come back regardless.
function ensureInit() {
  if (inited) return true;
  try { init(); } catch { /* world not ready yet */ }
  return inited;
}

world.afterEvents.worldLoad.subscribe(ensureInit);

system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (!ensureInit()) return;
  if (ev.id === `${NS}:start`) {
    // Start at the triggering player if there is one (parity with Java's
    // "execute as @p"), else at the nearest player to spawn.
    const player = ev.sourceEntity?.typeId === 'minecraft:player'
      ? ev.sourceEntity
      : world.getAllPlayers()[0];
    if (player) begin(player);
    else say('§cNo player online to start the ride at.');
  } else if (ev.id === `${NS}:stop`) {
    stop(false);
  }
}, { namespaces: [NS] });

system.runInterval(() => {
  if (!ensureInit()) return;

  if (!S.started) { autoStart(); return; }

  // Rider offline: freeze the whole ride until they return. (Java pauses the
  // same way in practice -- its pace cart stops being simulated when its
  // chunks unload -- but the virtual pace here would happily roll on and
  // build track through terrain nobody is watching.)
  if (!findRider()) return;

  // Per-tick driver, mirroring main.mcfunction's order:
  tickPace();                       // 1.  pace cart X (virtual)
  oceanCheck();                     // 1a. ocean speed-up
  let seat = findSeat();
  let cart = findCart();
  if (!seat || !cart) {
    // A rig piece got lost (killed, or its chunk hasn't loaded back in after
    // a rejoin). Wait a grace period before rebuilding the rig -- respawning
    // instantly while the original was merely still loading is exactly what
    // used to duplicate carts -- then re-summon on the rig position, the same
    // self-healing job as Java's mount keepers.
    S.rigMissing += 1;
    if (S.rigMissing > 40) {
      const sy = camFollow();
      const rigX = S.paceX + cfg('CAMAHEAD');
      if (sy !== undefined && chunkLoaded(rigX, S.centerZ)) {
        try {
          seat = spawnRig({
            x: rigX,
            y: sy + CART_REST + cfg('CAMHEIGHT') / 10,
            z: S.centerZ + 0.5,
          });
          cart = findCart();
          S.rigMissing = 0;
        } catch { /* rig chunk not ready yet; retry next tick */ }
      }
    }
  } else {
    S.rigMissing = 0;
  }
  if (seat && cart) {
    keepers(seat, cart);            // 2-4. mount chain, eject strangers, re-seat
    const sy = camFollow();         // 6.  the smoothed rail-line height
    if (sy !== undefined) camMove(seat, sy);
  }
  buildLoop();                      // 7.  extend the track

  if (--saveCountdown <= 0) { saveState(); saveCountdown = 40; }
});
