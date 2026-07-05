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
//      (only way to read heightmaps into           + walk down past foliage +
//       scoreboards)                               climb back up liquid columns
//                                                  (Bedrock's topmost probe
//                                                  skips liquids entirely)
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
//    forceload macro                           ->  an invisible SCOUT entity
//                                                  (minecraft:tick_world, this
//                                                  pack's BP+RP) gliding ahead
//                                                  of the ride as a mobile
//                                                  ticking area; /tickingarea
//                                                  can neither generate nor
//                                                  pre-load new terrain
//
//  The per-column pipeline is IDENTICAL to Java's advance.mcfunction:
//    1. sampleWindow() -> average surface of the next 48 blocks (12 samples,
//       clamped +/-UPCLAMP/DOWNCLAMP, void reads fall back to the average)
//    2. target = avg + HOVER  ->  written to the scoreboard, along with the
//       near-ground scan's .gfloor/.gmax/.gcone (nearScan -- slope timing)
//    3. "function infinite_rail/decide"  (the SHARED brain; reads .target,
//       .railY and the scan scores, keeps .slope/.flat/.lastDir, answers
//       with .dir)
//    4. place the column per .dir (carve, redstone support, rail, light)
//    5. append railY to the track history (the camera's map of the path)
//    6. every 16 blocks: rollChunks()
//
//  Scoreboard names: the shared functions use .NAME fake players on BOTH
//  editions ('.' is the proven-safe fake-player prefix on Bedrock's command
//  parser, and Java accepts it just as happily), so this script addresses
//  them as '.NAME' strings via the native scoreboard API.
//
//  The camera math in camFollow()/lifted() is a floating-point port of
//  cam_follow/cam_blend/cam_scan/cam_sample.mcfunction -- same construction,
//  same knobs, none of the milliblock fixed-point scaffolding. See CONTEXT.md
//  section 7g for the algorithm itself.
// =============================================================================

import { world, system, BlockPermutation, BlockVolume, EasingType, GameMode, ItemStack } from '@minecraft/server';
// The native pop-up used by the Settings book's mode menu. Safe as a static
// import: the manifest declares the @minecraft/server-ui 2.0.0 dependency
// (stable well before this pack's 1.21.120 floor), so the module is always
// provided wherever the pack loads at all.
import { ModalFormData } from '@minecraft/server-ui';
import { camHeight } from './cam_math.js';
// The vegetation the carve spares -- Bedrock's own hand-maintained list
// (keep it in sync with Java's tags/block/keep.json, the other edition's
// realization of the same policy). Bedrock commands have no block tags, so
// the classification runs at runtime instead.
import { isVegetation } from './vegetation.js';

// --- Constants ---------------------------------------------------------------

const NS = 'infinite_rail';
const OBJ = 'ir';
const P = '.'; // fake-player prefix (both editions; '.' survives Bedrock's parser)
const TAG_RIDE = 'ir_ride';
const TAG_SEAT = 'ir_seat';
// The invisible camera seat -- a custom entity from this pack's BP+RP pair
// (no gravity, no collision, two rider seats). The cart prop AND the player
// are its SIBLING passengers: passengers run no physics of their own, so
// the cart can never be captured by the powered rails under it, dragged by
// gravity, or bounced by ground contact -- and because the two are seated
// side by side rather than stacked, re-seating one can never eject the
// other. The script only ever moves the seat.
const SEAT_TYPE = 'infinite_rail:seat';
// The RIDE CART the player sits in -- a custom entity that RENDERS as a
// vanilla minecart (the RP client definition reuses geometry.minecart and
// its texture) but carries none of the minecart's client-side behavior.
// This matters because Bedrock clients tilt a real minecart's model 45
// degrees whenever it occupies a block cell containing an ascending rail --
// even as a physics-free passenger -- and the rig glides right along the
// track line, so at slope entries/exits a real ride cart visibly flickered
// between tilted and flat. The custom cart is pure geometry: it can never
// tilt, bounce, or play rolling sounds. (Its type_family includes
// "minecart" so the seat's rideable filter accepts it unchanged; a vanilla
// minecart is still used as a fallback when the BP is outdated.)
const CART_TYPE = 'infinite_rail:cart';
// Custom entities render their geometry at plain body yaw (the vanilla
// minecart RENDERER adds its own quarter-turn, which is why the old vanilla
// ride cart spawned at -90). geometry.minecart's long axis runs along X at
// yaw 0 -- aligned with the eastbound track.
const CART_YAW = 0;
// The chunk SCOUT -- a custom entity whose minecraft:tick_world component
// (radius 6 chunks = a 96-block ticking bubble, never_despawn) makes it a
// MOBILE TICKING AREA. It glides ahead of the rig, keeping the server-side
// loaded zone extended over terrain the rider's render distance generates,
// so the builder can read and place blocks far ahead of the cart. Command
// ticking areas can NOT do this job: /tickingarea neither generates new
// terrain nor loads it ahead of the generation frontier -- measured
// in-game, a 470-block corridor of them contributed zero loaded chunks and
// the builder crawled along the rider's own simulation bubble instead.
const SCOUT_TYPE = 'infinite_rail:scout';
const TAG_SCOUT = 'ir_scout';
const SCOUT_REACH = 96;  // tick_world radius 6 chunks, in blocks
const SCOUT_STEP = 8;    // max blocks/tick the scout glides
const SCOUT_Y = 180;     // cruising altitude (irrelevant to chunk ticking)
// The scout's post can't sit further ahead of the rig than this: its bubble
// (post - SCOUT_REACH) must always overlap the rider's own simulation bubble
// (>= 4 chunks = 64 blocks) with a chunk to spare, or a coverage hole opens
// between the two and the head can never walk across it.
const SCOUT_LEAD_MAX = 144;
// How far past the head buildReady() requires loaded chunks (the first third
// of the 48-block sample window; the rest may lag and fall back per-sample).
const BUILD_MARGIN = 17;
// How far past the head sample_window actually reaches. The scout post aims
// to keep this whole span inside its bubble -- samples beyond it don't break
// anything (they fall back to the rolling average) but cost probe attempts.
const SAMPLE_REACH = 48;
// Ticking-area names from older versions of this pack, removed on cleanup.
const LEGACY_AREAS = ['ir_area_a', 'ir_area_b', 'ir_t0', 'ir_t1', 'ir_t2', 'ir_t3'];
const PREFIX = '§6[Infinite Rail]§r ';
const DBG = '§3[IR debug]§r ';

// The SETTINGS BOOK -- the mode-menu opener. A plain book (no vanilla use
// action of its own), pinned into the rider's last hotbar slot by the
// inventory keeper; "using" it (right-click / hold) fires itemUse and opens
// the native mode menu (showMenu). Java's twin is a clickable written book
// (give_menu.mcfunction) since Java has no native forms. Identified by
// type + name so a random picked-up book could never open menus.
const SETTINGS_SLOT = 8; // last hotbar slot, matching Java's hotbar.8
const SETTINGS_ITEM = 'minecraft:book';
const SETTINGS_NAME = '§6Settings';

function makeSettingsItem() {
  const item = new ItemStack(SETTINGS_ITEM, 1);
  item.nameTag = SETTINGS_NAME;
  item.setLore(['§7Use to open the', '§7ride mode menu']);
  // Deliberately NOT slot-locked (ItemLockMode.slot): Bedrock decorates
  // locked items with a lock badge and a "Can't be moved / dropped /
  // removed / crafted with" tooltip block, which reads as clutter. The
  // inventory keeper re-pins the book every tick, so a moved or dropped
  // book heals itself within a tick anyway.
  return item;
}

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
  CAMAHEAD: 64, CAMMODE: 0, CARTYOFF: 12, HIDEHAND: 1, AUTOSTART: 1,
  MAXSPEED: 8, OCEANSPEED: 32, OCEANCHUNKS: 6, LANDCHUNKS: 3, DEADBAND: 2,
  SAMEGAP: 40, TURNGAP: 40, SLOPECLEAR: 8, UPCLAMP: 250, DOWNCLAMP: 20,
  UPLOOK: 50, UPGRACE: 10, UPEARLY: 6, DOWNLOOK: 16, DOWNGRACE: 1,
  AHEAD: 224, GENAHEAD: 192, MAXTICK: 15, DEBUGMODE: 0,
  SKYY: 180, SKYSPEED: 18, TORCHODDS: 35, TORCHRANGE: 32,
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
let AIR, RAIL_FLAT, RAIL_UP, RAIL_DOWN, SUPPORT, TORCH;
const LIGHT_BLOCK = 'minecraft:light_block_11';

// --- Ride state ----------------------------------------------------------------
// The Bedrock twin of Java's scoreboard runtime state (section 4.1 of
// CONTEXT.md), except that the event-model variables (.slope/.flat/.lastDir/
// .dir/...) deliberately do NOT appear here: they belong to the shared
// .mcfunction brain and live only in the scoreboard.

const S = {
  started: false,
  autodone: false,
  headX: 0,        // .headX -- world X of the build front (last built column)
  railY: 0,        // .railY -- current rail elevation
  centerZ: 0,      // the track's fixed Z centerline (block coordinate)
  avg: 0,          // .avg -- rolling average of the terrain surface
  nextLoad: 0,     // .nextLoad -- headX at which rollChunks() next fires
  trackBase: 0,    // .trackBase -- world X of trackY[0]
  trackY: [],      // storage infinite_rail:track y -- one rail Y per column
  paceX: 0,        // the VIRTUAL pace cart's X (replaces ir_cart; double)
  paceSpeed: 0,    // its current speed in blocks/tick (double)
  targetSpeed: 0,  // blocks/tick it is easing toward
  fast: false,     // .fast -- ocean cruising mode active
  oceanRun: 0,     // .oceanRun -- consecutive ocean chunks
  landRun: 0,      // .landRun -- consecutive non-ocean chunks
  lastChunk: 0,    // .lastChunk -- last chunk index the ocean check processed
  s2: 0,           // .s2 -- the reactive descent chaser (blocks; double)
  lastBad: 0,      // how many of the last column's 12 samples were fallbacks
  riderName: '',   // the one player this ride belongs to
  startTimer: 0,   // auto-start countdown (ticks with a player present)
  cartId: '',      // entity id of the ride cart (rediscovered by tag if stale)
  seatId: '',      // entity id of the camera seat (rediscovered by tag if stale)
  scoutId: '',     // entity id of the chunk scout (rediscovered by tag if stale)
  rigMissing: 0,   // consecutive ticks the rig has been missing (respawn grace)
  scoutMissing: 0, // consecutive ticks the scout has been missing (respawn grace)
  camActive: false, // whether the optional Camera API mode is currently applied
  teleportFallback: false, // set if applyImpulse is unavailable on the seat
};

let dim = null;   // the overworld
let inited = false;
let saveCountdown = 0;
// How the script talks to the shared .mcfunction brain. 'api' uses the native
// scoreboard API (normal). If the startup self-test finds that API-written
// scores are invisible to commands (a split some versions exhibit), it flips
// to 'cmd': brain inputs are written via /scoreboard commands and the brain's
// answer is read back through execute-if-score successCount probes.
let bridgeMode = 'api';
// Bumped by every begin() and stop(): a begin() in its async chunk-wait phase
// aborts if a newer begin/stop superseded it, so a stale poll can never
// resurrect a canceled ride.
let lifecycleGen = 0;

// Loud, rate-limited error reporting. A script error that is only swallowed
// (or only lands in the Content Log) presents in-game as "the pack does
// nothing", which is undebuggable for a player -- so every guarded top-level
// path reports its first error to chat, at most once per ~10 s.
let tickN = 0;
let lastErrAt = -1e9;
function reportError(where, e) {
  if (tickN - lastErrAt < 200) return;
  lastErrAt = tickN;
  try {
    world.sendMessage(`${PREFIX}§cError in ${where}: ${e}§7 (also check the Content Log)`);
  } catch { /* chat not available yet (early startup) */ }
}

// --- Small helpers -----------------------------------------------------------

function objective() {
  return world.scoreboard.getObjective(OBJ) ?? world.scoreboard.addObjective(OBJ);
}

function getScore(name, fallback) {
  // getScore is documented to throw; on some versions it throws for fake
  // players that have never been registered (rather than returning
  // undefined), so an unguarded read of a not-yet-set score can kill the
  // caller. Treat any throw exactly like "no score yet".
  try {
    const v = objective().getScore(P + name);
    return v === undefined ? fallback : v;
  } catch {
    return fallback;
  }
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

// Is debug output on? In command-bridge mode the API can't read the score, so
// it is probed through a command (cached for a second).
let dbgCache = false;
let dbgCacheAt = -100;
function debugOn() {
  if (bridgeMode === 'api') return cfg('DEBUGMODE') === 1;
  if (tickN - dbgCacheAt > 20) {
    dbgCacheAt = tickN;
    const r = runCmd(`execute if score ${P}DEBUGMODE ir matches 1 run scoreboard players add ${P}probe ir 1`);
    dbgCache = (r?.successCount ?? 0) > 0;
  }
  return dbgCache;
}
function dbg(msg) { if (debugOn()) world.sendMessage(DBG + msg); }

// Is a ride-mode toggle on? (.SKYMODE / .TORCHMODE -- the two modes the
// script acts on; rain and night are pure command files and never read
// here.) The mode functions only flip scoreboard scores, so reads go
// through the same bridge as the brain flags: the native API normally, a
// successCount probe on cmd-bridge worlds -- cached for a second there,
// because tickPace asks every tick.
const modeCache = new Map(); // name -> { at, v }
function modeOn(name) {
  if (bridgeMode === 'api') return getScore(name, 0) === 1;
  const c = modeCache.get(name);
  if (c && tickN - c.at <= 20) return c.v;
  const v = (runCmd(`execute if score ${P}${name} ir matches 1 run scoreboard players add ${P}probe ir 1`)?.successCount ?? 0) > 0;
  modeCache.set(name, { at: tickN, v });
  return v;
}

// The native mode menu (@minecraft/server-ui), opened by using the Settings
// book: one ModalFormData with a toggle per ride mode, pre-checked from the
// live scores, applied on submit by running the same mode_* function files
// the chat commands use -- so the menu, the commands and Java behave
// identically, tellraw feedback included. Only actual changes run anything.
function showMenu(player) {
  const current = {
    rain: modeOn('RAINMODE'),
    night: modeOn('NIGHTMODE'),
    torches: modeOn('TORCHMODE'),
    sky: modeOn('SKYMODE'),
  };
  const form = new ModalFormData()
    .title('Infinite Rail Settings')
    .toggle('Rain (permanent rain)', { defaultValue: current.rain })
    .toggle('Night (frozen at midnight)', { defaultValue: current.night })
    .toggle('Torches (scattered along new track)', { defaultValue: current.torches })
    .toggle('Sky (high-altitude cruise)', { defaultValue: current.sky })
    .submitButton('Apply');
  form.show(player).then((r) => {
    if (r.canceled || !r.formValues) return;
    const [rain, night, torches, sky] = r.formValues;
    const apply = (was, wanted, fn) => {
      if (was !== !!wanted) runCmd(`function ${NS}/mode_${fn}_${wanted ? 'on' : 'off'}`);
    };
    apply(current.rain, rain, 'rain');
    apply(current.night, night, 'night');
    apply(current.torches, torches, 'torches');
    apply(current.sky, sky, 'sky');
  }).catch((e) => reportError('settings menu', e));
}

function findRider() {
  if (!S.riderName) return undefined;
  return world.getAllPlayers().find((p) => p.name === S.riderName);
}

// Find the one live entity wearing our tag, REMOVING any duplicates: rejoin
// races (a replacement spawned before the original's chunk loaded back in)
// and stale sessions can leave extras behind, and an untracked cart would
// keep drifting around the line forever. type may be null to match the tag
// across entity types (the ride cart can be the custom type or the vanilla
// fallback); preferType breaks ties in favor of the modern type when both
// generations are present after an upgrade.
function findTagged(type, tag, preferId, preferType) {
  let tagged;
  try {
    tagged = dim.getEntities(type ? { type, tags: [tag] } : { tags: [tag] });
  } catch { return undefined; }
  const keep = tagged.find((e) => e.id === preferId && e.isValid)
    ?? (preferType ? tagged.find((e) => e.typeId === preferType && e.isValid) : undefined)
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
  const cart = findTagged(null, TAG_RIDE, S.cartId, CART_TYPE);
  if (cart) S.cartId = cart.id;
  return cart;
}

function findSeat() {
  const seat = findTagged(SEAT_TYPE, TAG_SEAT, S.seatId);
  if (seat) S.seatId = seat.id;
  return seat;
}

function findScout() {
  const scout = findTagged(SCOUT_TYPE, TAG_SCOUT, S.scoutId);
  if (scout) S.scoutId = scout.id;
  return scout;
}

function chunkLoaded(x, z) {
  // getBlock is documented to return undefined for unloaded chunks, which
  // makes it the most portable "is this column ready" probe.
  try { return dim.getBlock({ x, y: 100, z }) !== undefined; } catch { return false; }
}

// --- The brain bridge ----------------------------------------------------------
// All traffic between this script and the shared decide/consider_start brain
// goes through these two functions, so the whole pack keeps working even on
// versions where the scoreboard API and command scoreboards don't see each
// other (bridgeMode 'cmd', chosen by the startup self-test).

function brainSet(name, value) {
  if (bridgeMode === 'api') setScore(name, value);
  else runCmd(`scoreboard players set ${P}${name} ir ${value | 0}`);
}

function brainGetDir() {
  if (bridgeMode === 'api') return getScore('dir', 0);
  // successCount probes: the execute's run-command succeeds iff the condition
  // matched. Two probes distinguish the three possible answers.
  if ((runCmd(`execute if score ${P}dir ir matches 1 run scoreboard players add ${P}probe ir 1`)?.successCount ?? 0) > 0) return 1;
  if ((runCmd(`execute if score ${P}dir ir matches 0 run scoreboard players add ${P}probe ir 1`)?.successCount ?? 0) > 0) return 0;
  return -1;
}

// Read one of the brain's 0/1 answers (the carve-mode flags .veg / .retro).
function brainGetFlag(name) {
  if (bridgeMode === 'api') return getScore(name, 0) === 1;
  return (runCmd(`execute if score ${P}${name} ir matches 1 run scoreboard players add ${P}probe ir 1`)?.successCount ?? 0) > 0;
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
// over motion_blocking_no_leaves" trick, in three moves:
//   1. dimension.getTopmostBlock() -- which on current Bedrock SKIPS LIQUIDS
//      entirely: over an ocean it answers the sea FLOOR, not the surface;
//   2. a climb back UP to the true top of the column (the liquid surface,
//      when there is one) -- Java's heightmap counts liquid surfaces as
//      terrain, which is what makes oceans read as sea level and get
//      bridged instead of dived into;
//   3. a short walk DOWN past anything Java's motion_blocking_no_leaves
//      heightmap would also ignore (leaves, collision-less foliage).
// Returns the Y one above the (possibly liquid) surface -- the same convention
// as the Java heightmap -- or undefined for void/unloaded reads.

// One ride samples every X twelve times (the 12-sample window slides one block
// per column), and the ocean climb makes a deep-water sample cost tens of
// block reads -- so completed reads are memoized per column until the head
// passes them (pruned in rollChunks, reset by begin).
const surfMemo = new Map();

function surfaceY(x, z) {
  // At the edge of the ticking set (the border ring of the scout's bubble)
  // lookups can SUCCEED and hand back a Block whose property reads then
  // throw LocationInUnloadedChunkError -- "loaded" and "ticking" are
  // different states there. Any throw anywhere in the probe means exactly
  // one thing: no usable data at this column yet. Report it like an
  // unloaded read (the sample falls back to the rolling average) instead of
  // letting it abort the whole column.
  try { return probeSurface(x, z); } catch { return undefined; }
}

function probeSurface(x, z) {
  if (z === S.centerZ && surfMemo.has(x)) return surfMemo.get(x);
  let block;
  try { block = dim.getTopmostBlock({ x, z }); } catch { return undefined; }

  // getTopmostBlock SKIPS LIQUIDS on current Bedrock: over an ocean it
  // answers the sea FLOOR (measured in-game: avg=34 across a y=62 ocean, and
  // the rail dived to the seabed accordingly). Climb back up to the true top
  // of the column first -- everything stacked above the topmost non-liquid
  // block can only be the liquid column and its waterlogged flora, so "not
  // air" is the whole test. On dry land the block above is air and this is a
  // single wasted read.
  if (block) {
    try {
      for (let up = 0; up < 128; up++) {
        const above = dim.getBlock({ x, y: block.y + 1, z });
        if (!above || above.isAir === true || above.typeId === 'minecraft:air') break;
        if (above.isAir === undefined && above.typeId === undefined) break; // API blind here: don't climb into the sky
        block = above;
      }
    } catch { /* top of the column is unloaded: keep what we have */ }
  }

  for (let i = 0; block && i < 48; i++) {
    const id = block.typeId ?? '';
    let surf;
    if (id === 'minecraft:water' || id === 'minecraft:flowing_water' || block.isLiquid === true) {
      // A liquid surface counts as terrain, exactly like Java's heightmap --
      // this is what makes oceans read as sea level and get bridged.
      surf = block.y + 1;
    } else if (id.includes('leaves') || block.isSolid === false) {
      // Skip what Java's motion_blocking_no_leaves skips: leaves, and blocks
      // the engine reports as explicitly NON-solid (foliage, snow layers).
      // The comparisons are deliberately against literal true/false: if
      // isSolid / isLiquid are unavailable on this module version they read
      // undefined, and the block is ACCEPTED as surface -- a flower
      // miscounted as ground costs a block of noise (well inside .DEADBAND),
      // whereas skipping everything would freeze the terrain average and
      // flatline the whole ride.
      // Step down with getBlock, NOT getTopmostBlock(pos, y-1) -- the latter
      // can get stuck returning the same block, which turned every
      // foliage-covered column into an undefined read.
      try { block = dim.getBlock({ x, y: block.y - 1, z }); } catch { return undefined; }
      continue;
    } else {
      surf = block.y + 1;
    }
    if (z === S.centerZ) {
      surfMemo.set(x, surf);
      if (surfMemo.size > 4096) surfMemo.clear(); // backstop; rollChunks prunes
    }
    return surf;
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
  let bad = 0;
  for (let off = 4; off <= 48; off += 4) {
    let s = surfaceY(S.headX + off, S.centerZ);
    if (s === undefined || s <= -63) { s = S.avg; bad += 1; } // void: discard
    if (s < lo) s = lo;
    if (s > hi) s = hi;
    sum += s;
  }
  S.avg = Math.floor(sum / 12);
  S.lastBad = bad; // surfaced in the debug roll line: 12/12 = probe is broken
}

// The near-ground scan feeding the shared brain's slope-timing guards
// (decide's .dig/.dig2/.push/.due and consider_start's start rules --
// CONTEXT.md section 7j): probed every 2 blocks at odd offsets +1, +3, +5,
// ... exactly like Java's near_scan/near_step. Consecutive probes fold into
// PAIRS -- min(this, prev) -- because the surface probe counts tree trunks
// as ground: a 1-2 block spike only catches one probe of a pair, so the min
// erases it, while real terrain (4+ wide) spans both probes and registers.
// Three scores result: .gfloor (highest pair within .DOWNLOOK -- the
// descent guard), .gmax (highest pair within .UPLOOK -- the climb contact
// trigger) and .gcone (the climb schedule: over pairs actually in the way,
// above railY - HOVER, the highest 45-degree projection pair - distance).
// Sentinels: -10000 for .gfloor/.gmax (their guards fail open without
// data) and for a .gcone with nothing to climb for (the schedule gate
// holds); +32000 for .gcone when the scan got no valid probes at all
// (reverts to plain average-driven behavior). The reads hit the per-column
// surface memo the 48-block sample window already fills, so the scan costs
// no extra real probes.
function nearScan() {
  const up = cfg('UPLOOK');
  const down = cfg('DOWNLOOK');
  const w = Math.min(48, Math.max(up, down));
  const gbase = S.railY - cfg('HOVER');
  let gfloor = null;
  let gmax = null;
  let gcone = null;
  let valid = 0;
  let prev = null;
  for (let off = 1; off <= w; off += 2) {
    const s = surfaceY(S.headX + off, S.centerZ);
    if (s === undefined || s <= -63) { prev = null; continue; }
    valid += 1;
    if (prev !== null) {
      const pmin = Math.min(prev, s);
      const nd = off - 2; // the pair's near end
      if (off <= down && (gfloor === null || pmin > gfloor)) gfloor = pmin;
      if (off <= up) {
        if (gmax === null || pmin > gmax) gmax = pmin;
        if (pmin > gbase && (gcone === null || pmin - nd > gcone)) gcone = pmin - nd;
      }
    }
    prev = s;
  }
  brainSet('gfloor', gfloor ?? -10000);
  brainSet('gmax', gmax ?? -10000);
  brainSet('gcone', gcone ?? (valid === 0 ? 32000 : -10000));
}

// --- Column placement ----------------------------------------------------------
// place_flat / place_up / place_down + carve + support, in native block API
// calls. Same order as Java: carve the bore first, then the support (the rail
// needs it to exist), then the rail, then the light.
//
// The support is this pack's CUSTOM BLOCK infinite_rail:support (BP
// blocks/support.json): it renders with the vanilla smooth-stone texture and
// carries minecraft:redstone_producer at full strength, so it powers the
// rail exactly like a block of redstone while looking like a plain stone
// pier. Bedrock has no block_display entities, so where Java DISGUISES its
// redstone block with a display, Bedrock's support genuinely IS the
// disguise -- one block, no entity. Falls back to a bare redstone block if
// the custom block is unavailable (outdated behavior pack).

// Clear one cell UNLESS it holds natural vegetation (the shared
// vegetation.js classification -- Java's carve_layer does the same per-cell
// test against the generated #infinite_rail:keep block tag). Air is left
// untouched so open ground costs one read and zero writes.
function clearSoft(x, y, z) {
  try {
    const b = dim.getBlock({ x, y, z });
    if (!b || b.isAir === true) return;
    if (isVegetation(b.typeId ?? '')) return;
    dim.setBlockType({ x, y, z }, 'minecraft:air');
  } catch { /* border chunk: the loop heals it on a later pass-through */ }
}

// The carve is VEGETATION-SPARING, mirroring Java's carve/carve_layer cell
// rules exactly (the shared brain decides WHICH columns may spare -- veg):
//   - center, rail cell + 1 above: ALWAYS cleared (cart + rider pass here)
//   - center, >= 2 above the rail: one unconditional fill when veg is false
//     (slope columns and the .SLOPECLEAR buffer around them -- the camera
//     floats above the rail line there), per-cell vegetation-sparing when
//     veg is true
//   - left and right: ALWAYS vegetation-sparing, at every height
// Terrain (stone, dirt, ...) is never spared, so tunnels are unchanged.
function placeColumn(x, y, dir, veg) {
  const z = S.centerZ;
  const carveH = dir === 0 ? cfg('TUNNEL') : cfg('TUNNEL') + 1; // .TUNNELUP
  dim.fillBlocks(
    new BlockVolume({ x, y, z }, { x, y: y + 1, z }),
    AIR, { ignoreChunkBoundErrors: true },
  );
  if (!veg && carveH >= 2) {
    dim.fillBlocks(
      new BlockVolume({ x, y: y + 2, z }, { x, y: y + carveH, z }),
      AIR, { ignoreChunkBoundErrors: true },
    );
  }
  for (let dy = 0; dy <= carveH; dy++) {
    clearSoft(x, y + dy, z - 1);
    clearSoft(x, y + dy, z + 1);
    if (veg && dy >= 2) clearSoft(x, y + dy, z);
  }
  dim.setBlockPermutation({ x, y: y - 1, z }, SUPPORT);
  dim.setBlockPermutation({ x, y, z }, dir === 0 ? RAIL_FLAT : dir === 1 ? RAIL_UP : RAIL_DOWN);
  dim.setBlockType({ x, y: y + 3, z }, LIGHT_BLOCK);
}

// Torch mode (.TORCHMODE -- mode_torches_on): sprinkle torches on the
// terrain around the line as it is built. The native twin of Java's
// place_torch/torch_at/torch_try: same odds knob (.TORCHODDS percent of
// columns), same 2..TORCHRANGE side offsets, same "skip every doubtful
// spot" rule -- a missing torch is invisible, a floating or popped one is
// not. Only onto ground the surface probe answers for, only into an air
// cell, and never onto water/lava (the probe counts liquid surfaces as
// terrain), ice (torches can't attach), leaves, snow layers or other
// non-solid tops. The 48 cap matches Java's (its widened forceload
// corridor's ceiling); here the scout bubble covers +-96 blocks anyway.
function maybeTorch(x) {
  if (Math.random() * 100 >= cfg('TORCHODDS')) return;
  const side = Math.random() < 0.5 ? -1 : 1;
  let range = cfg('TORCHRANGE');
  if (range < 2) range = 2;   // 2 keeps torches out of the carved bore
  if (range > 48) range = 48;
  const z = S.centerZ + side * (2 + Math.floor(Math.random() * (range - 1))); // 2..range off-center
  try {
    const surf = surfaceY(x, z); // Y one above the surface, like the Java heightmap
    if (surf === undefined || surf <= -63) return;
    const below = dim.getBlock({ x, y: surf - 1, z });
    const cell = dim.getBlock({ x, y: surf, z });
    if (!below || !cell) return;
    if (below.isLiquid === true || below.isSolid === false) return;
    const bid = below.typeId ?? '';
    if (bid.includes('ice') || bid.includes('leaves') || bid === 'minecraft:snow_layer') return;
    if (!(cell.isAir === true || cell.typeId === 'minecraft:air')) return;
    dim.setBlockPermutation({ x, y: surf, z }, TORCH);
  } catch { /* border chunk: skip this torch */ }
}

// A slope just started (the shared start_event raised .retro): retroactively
// clear the FULL center bore over the last .SLOPECLEAR columns -- the camera
// lifts off the rail line before the slope arrives, so vegetation spared
// over those (flat, same-elevation) columns must go after all. Vertical
// only: the cells left and right of the track keep their plants. Java's
// retro_clear/retro_fill is the same fill, clamped the same way.
function retroClear(headX) {
  const k = Math.min(cfg('SLOPECLEAR'), headX - S.trackBase);
  const h = cfg('TUNNEL');
  if (k < 0 || h < 2) return;
  dim.fillBlocks(
    new BlockVolume({ x: headX - k, y: S.railY + 2, z: S.centerZ },
      { x: headX, y: S.railY + h, z: S.centerZ }),
    AIR, { ignoreChunkBoundErrors: true },
  );
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
  // the scoreboard, exactly as on Java. The near scan adds the three
  // ground-contact inputs (.gfloor/.gmax/.gcone) beside .target/.railY.
  brainSet('target', target);
  brainSet('railY', S.railY);
  nearScan();
  dim.runCommand(`function ${NS}/decide`);
  const dir = brainGetDir();
  // The brain's carve-mode answers (see decide/start_event in src/shared):
  // veg = this column may spare vegetation; retro = a slope just started, so
  // the columns behind the head lose their spared center bore after all.
  const veg = brainGetFlag('veg');
  if (brainGetFlag('retro')) {
    retroClear(S.headX);
    brainSet('retro', 0);
  }

  const colX = S.headX + 1;
  if (dir === -1) {
    S.railY -= 1;                        // descend: the rail sits one lower,
    placeColumn(colX, S.railY, -1, veg); // sloping up toward the west behind it
  } else if (dir === 1) {
    placeColumn(colX, S.railY, 1, veg);  // climb: ascending rail at the current
    S.railY += 1;                        // level, then the line steps up
  } else {
    placeColumn(colX, S.railY, 0, veg);
  }
  S.headX = colX;

  // Torch mode: maybe plant a torch on the terrain beside this column
  // (advance.mcfunction's step 5b on Java).
  if (modeOn('TORCHMODE')) maybeTorch(colX);

  S.trackY.push(S.railY);
  if (S.trackY.length > HIST_MAX + 256) {
    const drop = S.trackY.length - HIST_MAX;
    S.trackY.splice(0, drop);
    S.trackBase += drop;
  }

  if (S.headX >= S.nextLoad) rollChunks();
}

// A column may only be built once its OWN chunk and a one-chunk margin ahead
// (BUILD_MARGIN blocks -- the first third of the sample window, at least 4 of
// the 12 samples) are loaded. The REST of the 48-block window is allowed to
// lag: sampleWindow falls back to the rolling average per missing sample, so
// the average keeps following the terrain it can see instead of freezing --
// which is the failure this guard exists to prevent (deciding columns with
// ZERO real samples bakes a permanently flat line into the world). Requiring
// the entire window here, as this guard originally did, pinned the head to
// the generation frontier minus 49 blocks and made the track appear in
// stop-and-go bursts right in front of the rider.
function buildReady() {
  for (let off = 1; off <= BUILD_MARGIN; off += 16) {
    if (!chunkLoaded(S.headX + off, S.centerZ)) return false;
  }
  return true;
}

let stallTicks = 0;
let stallWarned = false;
let lastBuildErrAt = -1e9; // rate limit: a stuck column would otherwise spam every tick

function buildLoop() {
  let budget = cfg('MAXTICK');
  const ahead = cfg('AHEAD');
  let built = false;
  while (budget > 0 && S.headX - Math.floor(S.paceX) < ahead) {
    if (!buildReady()) break;
    budget -= 1;
    try {
      advance();
    } catch (e) {
      if (tickN - lastBuildErrAt > 100) {
        lastBuildErrAt = tickN;
        dbg(`build error at x=${S.headX + 1}: ${e}`);
      }
      break;
    }
    built = true;
  }
  // If the builder is starved for terrain while the track buffer is running
  // low, say so once -- the likeliest causes are a missing scout (outdated
  // packs) or a low render distance capping how far terrain generates.
  if (!built && S.headX - Math.floor(S.paceX) < ahead - 64) {
    stallTicks += 1;
    if (stallTicks === 200 && !stallWarned) {
      stallWarned = true;
      say('§eTerrain ahead is generating slowly; the ride will ease off until it catches up. Make sure render distance is at least ~20 chunks. Run §b/function infinite_rail/debug§e for chunk-loading status.');
    }
  } else {
    stallTicks = 0;
  }
}

// --- Chunk management ----------------------------------------------------------
// roll_chunks/forceload: keep terrain open ahead of the head and roll the
// world spawn + respawn points forward with the ride.
//
// Bedrock reality (measured in-game, and the reason two earlier /tickingarea
// corridor designs never worked): NOTHING server-side generates or pre-loads
// terrain except a player. /tickingarea keeps already-active chunks ticking
// but contributes zero new ones, so a track builder gated on loaded chunks
// crawls along the leading edge of the rider's own simulation bubble --
// building in bursts right in front of the cart.
//
// What DOES work is the vanilla minecraft:tick_world entity component (the
// ender dragon's chunk loader): an entity carrying it is a mobile ticking
// area, radius up to 6 chunks, active regardless of player distance. The
// SCOUT is this pack's invisible carrier. It glides up to scoutTargetX()
// ahead of the ride, stepping only onto ground whose chunk is already open
// (its own bubble requests the next chunks; the rider's render distance
// generates them), so between the rider's bubble and the scout's the whole
// corridor from the rig to ~.AHEAD blocks ahead of the pace stays readable.

// The scout's post: far enough ahead that its bubble covers the ENTIRE
// sample window of a head at full gap (head at paceX + .AHEAD, sampling to
// +SAMPLE_REACH, +8 slack) -- covering only the buildReady margin, as an
// earlier version did, left the far samples poking past the bubble into
// border chunks every column at full gap. Never behind the rig, and never
// so far ahead that the bubble detaches from the rider's own (see
// SCOUT_LEAD_MAX); past that ceiling the far samples degrade gracefully.
function scoutTargetX() {
  const lead = cfg('AHEAD') - cfg('CAMAHEAD') + SAMPLE_REACH + 8 - SCOUT_REACH;
  return S.paceX + cfg('CAMAHEAD') + Math.min(SCOUT_LEAD_MAX, Math.max(16, lead));
}

// Per-tick scout keeper + mover, same self-healing pattern as the rig: a
// missing scout (killed, or its chunk not restored yet after a rejoin) gets
// a grace period, then is respawned at the rig -- the one place the rider
// guarantees is loaded -- and walks itself back east to its post.
function tickScout() {
  let scout = findScout();
  if (!scout) {
    S.scoutMissing += 1;
    if (S.scoutMissing > 40) {
      const rigX = S.paceX + cfg('CAMAHEAD');
      if (chunkLoaded(rigX, S.centerZ)) {
        try {
          scout = dim.spawnEntity(SCOUT_TYPE, { x: rigX, y: SCOUT_Y, z: S.centerZ + 0.5 });
          scout.addTag(TAG_SCOUT);
          S.scoutId = scout.id;
          S.scoutMissing = 0;
        } catch { /* scout type unavailable (outdated BP): ride on without it */ }
      }
    }
    if (!scout) return;
  } else {
    S.scoutMissing = 0;
  }

  let x;
  try { x = scout.location.x; } catch { return; } // handle went stale this tick
  let step = scoutTargetX() - x;
  if (step > SCOUT_STEP) step = SCOUT_STEP;
  else if (step < -SCOUT_STEP) step = -SCOUT_STEP;
  const nx = x + step;
  if (!chunkLoaded(Math.floor(nx), S.centerZ)) {
    // The next chunk isn't generated yet: hold this frontier -- the bubble
    // is already asking for it. (Backward onto unloaded ground can only
    // mean the scout is stranded way off post, e.g. after a resume: snap
    // it home to the rig instead.)
    if (step < 0) {
      const rigX = S.paceX + cfg('CAMAHEAD');
      if (chunkLoaded(rigX, S.centerZ)) {
        try { scout.teleport({ x: rigX, y: SCOUT_Y, z: S.centerZ + 0.5 }); } catch { /* retry */ }
      }
    }
    return;
  }
  try { scout.teleport({ x: nx, y: SCOUT_Y, z: S.centerZ + 0.5 }); } catch { /* retry next tick */ }
}

// Ticking areas created by older versions of this pack would otherwise sit in
// the world save forever; sweep them whenever a ride starts or stops.
function clearLegacyAreas() {
  for (const name of LEGACY_AREAS) runCmd(`tickingarea remove ${name}`);
}

function rollChunks() {
  const x = S.headX, y = S.railY, z = S.centerZ;
  runCmd(`setworldspawn ${x} ${y + 1} ${z}`);
  runCmd(`spawnpoint @a ${x} ${y + 1} ${z}`);
  S.nextLoad += 16;
  // Drop surface-probe memo entries the head has passed.
  for (const k of surfMemo.keys()) if (k < x) surfMemo.delete(k);
  if (debugOn()) {
    // The contiguous loaded frontier past the head, the scout's lead on the
    // head, and the terrain algorithm's live numbers -- at a glance: is the
    // scout keeping chunks open ahead (the frontier should track it), and is
    // the elevation logic getting data (badSamples 12/12 = probe broken).
    let frontier = 0;
    while (frontier < 512 && chunkLoaded(x + frontier + 16, z)) frontier += 16;
    const scout = findScout();
    let scoutAt = null;
    try { if (scout) scoutAt = Math.round(scout.location.x - x); } catch { /* stale handle */ }
    const scoutTxt = scoutAt === null ? '§cMISSING§7' : `§f${scoutAt >= 0 ? '+' : ''}${scoutAt}§7`;
    // ops = rig operations since the previous roll line (16 blocks of
    // travel): mounts/ejects/corrective teleports. All zeros while a
    // problem is audible or visible = the script is NOT doing it.
    dbg(`x=${x}: loaded §f+${frontier}§7 scout=${scoutTxt} | badSamples=§f${S.lastBad}§7/12 avg=§f${S.avg}§7 railY=§f${S.railY}§7 ops=§fm${ops.mount}/e${ops.eject}/t${ops.tp}§7 drive=${S.teleportFallback ? '§ctp§7' : 'imp'} bridge=${bridgeMode}`);
    ops.mount = 0; ops.eject = 0; ops.tp = 0;
  }
}

// --- Ocean speed-up ------------------------------------------------------------
// ocean_check/speed_up/speed_down. Java drives the minecart max-speed gamerule
// and lets rail physics do the rest; that gamerule doesn't exist on Bedrock, so
// the virtual pace speed is steered directly (targetSpeed, eased by ACCEL in
// tickPace) -- same trigger logic, same knobs, same per-chunk cadence.

function oceanCheck() {
  // Sky mode owns the ride speed while it is on (and the line flies far
  // above any water anyway) -- skip the whole ocean system. tickPace resets
  // the counters and .fast on the toggle-off transition.
  if (modeOn('SKYMODE')) return;
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
let skyWas = false; // last tick's .SKYMODE, to catch the toggle-off transition
function tickPace() {
  // Sky mode (mode_sky_on) owns the speed outright: .SKYSPEED is asserted
  // every tick while it is on (so it is live-tweakable, like .MAXSPEED), and
  // the moment it turns off the ocean system gets the speed back with fresh
  // counters -- Java's mode_sky_off does the same reset explicitly.
  const sky = modeOn('SKYMODE');
  if (sky) {
    S.targetSpeed = cfg('SKYSPEED') / 20;
  } else if (skyWas) {
    S.fast = false;
    S.oceanRun = 0;
    S.landRun = 0;
    S.targetSpeed = cfg('MAXSPEED') / 20;
  } else if (!S.fast) {
    S.targetSpeed = cfg('MAXSPEED') / 20; // land speed stays live-tweakable
  }
  skyWas = sky;
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

// cam_move: fly the rig to CAMAHEAD blocks east of the pace position at the
// smoothed height. The rig's two visible-motion pieces are driven the SAME
// way but INDEPENDENTLY: the seat (carrying the player, the ride's only
// mount) and the cart prop, which is NOT mounted on anything -- it is pure
// scenery glided in lockstep by this function. Entity passengers proved
// unkeepable on Bedrock (the engine ejected the seated cart within ticks,
// parking it over the rider's head, and every mount-state query
// under-reports), so the script simply owns the cart's motion outright.
// Both entities are driven by velocity: Bedrock clients interpolate physics
// motion smoothly, where per-tick teleports strobe at 20 fps; and because
// neither has gravity or collision, the commanded motion is exactly the
// motion that happens. A drift catch teleports a piece back if anything
// knocks it far off.
// Rig-operation counters, printed (and reset) on every debug roll line:
// while a problem is audible/visible, these say definitively whether the
// script is performing mounts / ejects / corrective teleports, or idle.
const ops = { mount: 0, eject: 0, tp: 0 };
let lastOpAt = -1e9;
function dbgOp(msg) {
  if (tickN - lastOpAt < 20) return; // at most one op line per second
  lastOpAt = tickN;
  dbg(msg);
}

function glide(ent, target) {
  let pos;
  try { pos = ent.location; } catch { return; }
  const d = { x: target.x - pos.x, y: target.y - pos.y, z: target.z - pos.z };
  const drift = Math.abs(d.x) + Math.abs(d.y) + Math.abs(d.z);
  if (drift > 4 || S.teleportFallback) {
    ops.tp += 1;
    try { ent.teleport(target, { keepVelocity: false }); } catch { /* unloaded */ }
  } else {
    try {
      ent.clearVelocity();
      ent.applyImpulse(d);
    } catch {
      if (!S.teleportFallback) {
        S.teleportFallback = true; // impulse unsupported: teleport from now on
        dbg('impulse drive unavailable -- switching to teleport drive (less smooth)');
      }
    }
  }
}

function camMove(seat, cart, sy) {
  const target = {
    x: S.paceX + cfg('CAMAHEAD'),
    y: sy + CART_REST + cfg('CAMHEIGHT') / 10,
    z: S.centerZ + 0.5,
  };
  glide(seat, target);
  if (cart) {
    // The vanilla minecart geometry draws one block above a custom
    // entity's position (it expects the engine's internal renderer), so
    // the pack ships a re-based copy (geometry.ir_cart, all cubes shifted
    // down 16px -- measured in-game). .CARTYOFF (tenths of a block)
    // remains as a small fine-tune; large offsets would sink the cart
    // ENTITY into the track blocks, where it suffocates. The
    // vanilla-minecart fallback renders true and gets no offset.
    let cy = target.y;
    try { if (cart.typeId === CART_TYPE) cy += cfg('CARTYOFF') / 10; } catch { /* stale */ }
    glide(cart, { x: target.x, y: cy, z: target.z });
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

// Spawn the two-piece rig at a position: the invisible seat (which the
// player will ride) and the unmounted cart prop that camMove glides along
// with it. Returns the seat (the mover), or throws if the chunk isn't
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
    cart = dim.spawnEntity(CART_TYPE, pos, { initialRotation: CART_YAW });
  } catch {
    // Outdated BP without the custom cart: a real minecart still works, it
    // just shows the client's rail-tilt flicker on slope entries/exits.
    try {
      cart = dim.spawnEntity('minecraft:minecart', pos, { initialRotation: -90 });
    } catch {
      cart = dim.spawnEntity('minecraft:minecart', pos);
    }
  }
  cart.addTag(TAG_RIDE);
  S.cartId = cart.id;
  return seat;
}

// --- Keepers ---------------------------------------------------------------
// main.mcfunction's per-tick guards, minus everything the virtual pace cart
// and the unmounted cart prop made obsolete (plug, stall re-boost, pace-cart
// ejections, cart re-seating -- camMove owns the cart's motion outright).
//
// The one mount in the whole rig is the player on the seat, and its state is
// judged POSITIONALLY, never via mount-state APIs: the passenger's
// 'minecraft:riding' component and the vehicle's rider list both
// under-report on Bedrock, and treating "can't see it" as "not riding" made
// earlier keepers re-mount the seated rig every tick -- each spurious
// re-mount ejects and re-seats passengers (pose flicker, mount-sound spam).
// A seated player is pinned to the seat while the rig glides east at
// cruising speed, so a genuine dismount shows up as distance from the seat
// that keeps growing tick after tick; only that sustained streak triggers a
// re-mount.
const ASTRAY_TICKS = 4; // consecutive too-far ticks before a re-mount
let riderAstray = 0;

// Is this player still "on the ride" for keeper purposes? Rides now run in
// SURVIVAL (adventure suppresses Bedrock's natural mob spawning), but
// adventure is still accepted so rides saved by older pack versions resume
// seamlessly. Switching to creative remains the sanctioned way to leave.
function ridingMode(gm) {
  return gm === GameMode.Survival || gm === GameMode.Adventure;
}

// Mount the ride's player onto the seat via the /ride COMMAND, not the
// scripting addRider() API. Every mount in this saga went through
// addRider, and the client's link state kept coming out flaky (phantom
// footstep/walking sounds while visibly seated, pose resyncing on a manual
// Ctrl press) -- /ride is the long-established command path and
// teleport_rider brings the player to the seat as part of the same
// operation. Falls back to addRider if the command is unavailable.
function mountRider() {
  ops.mount += 1;
  const r = runCmd(`ride "${S.riderName}" start_riding @e[type=${SEAT_TYPE},tag=${TAG_SEAT},c=1] teleport_rider`);
  if ((r?.successCount ?? 0) > 0) return true;
  try {
    const seat = findSeat();
    const rider = findRider();
    if (seat && rider) {
      seat.getComponent('minecraft:rideable')?.addRider(rider);
      return true;
    }
  } catch { /* seat momentarily invalid */ }
  return false;
}

function keepers(seat) {
  const seatRideable = seat.getComponent('minecraft:rideable');
  if (!seatRideable) return;
  let sp;
  try { sp = seat.location; } catch { return; }
  const distToSeat = (loc) =>
    Math.abs(loc.x - sp.x) + Math.abs(loc.y - sp.y) + Math.abs(loc.z - sp.z);

  // Purity sweep: the seat carries exactly this ride's player (matched by
  // NAME -- the most stable identity across handles). Best-effort -- if the
  // rider list under-reports, nothing breaks; this is never used as a
  // mount-state check.
  try {
    for (const r of seatRideable.getRiders()) {
      let spare = false;
      try { spare = r.typeId === 'minecraft:player' && r.name === S.riderName; } catch { /* stale */ }
      if (spare) continue;
      try {
        seatRideable.ejectRider(r);
        ops.eject += 1;
        dbgOp(`keeper: ejected a stray ${r.typeId ?? 'entity'} from the seat`);
      } catch { /* already off */ }
    }
  } catch { /* rider list unavailable */ }

  const rider = findRider();
  if (!rider) return;

  // Rider keeper (sneak-dismounts, rejoins): positional rule -- the seated
  // offset is 0.35, so anything under the threshold is "aboard". Only
  // survival/adventure players are recaptured -- switching to creative is
  // the sanctioned way to leave the ride and wander off. /ride's
  // teleport_rider brings a far-away rider (respawned at the rolled
  // spawnpoint) back to the rig as part of the mount.
  if (ridingMode(rider.getGameMode())) {
    let riderFar = true;
    let d = -1;
    try { d = distToSeat(rider.location); riderFar = d > 2.5; } catch { /* treat as far */ }
    if (riderFar) {
      riderAstray += 1;
      if (riderAstray >= ASTRAY_TICKS) {
        riderAstray = 0;
        mountRider();
        dbgOp(`keeper: re-seated the rider (was ${d < 0 ? '?' : d.toFixed(1)} blocks off)`);
      }
    } else {
      riderAstray = 0;
    }
  } else {
    riderAstray = 0;
  }

  // Keep the rider's inventory empty -- except the pinned Settings book,
  // the mode-menu opener -- hiding held items and stopping item pickup.
  try {
    const inv = rider.getComponent('minecraft:inventory')?.container;
    if (inv) {
      for (let i = 0; i < inv.size; i++) {
        if (i === SETTINGS_SLOT) continue;
        if (inv.getItem(i)) inv.setItem(i, undefined);
      }
      const cur = inv.getItem(SETTINGS_SLOT);
      if (!cur || cur.typeId !== SETTINGS_ITEM || cur.nameTag !== SETTINGS_NAME) {
        inv.setItem(SETTINGS_SLOT, makeSettingsItem());
      }
    }
  } catch { /* container busy */ }

  // Hide-hand (.HIDEHAND, the automatic "Hide Hand" video setting): Bedrock's
  // /hud command has no element for the first-person arm, but the
  // invisibility effect removes it -- and with the inventory kept empty,
  // nothing renders at all. Re-asserted once a second so the knob is
  // live-tunable; stop() clears it with the other effects. (Side effect: the
  // rider's body is also hidden in third-person/F5 -- documented trade-off.)
  if (tickN % 20 === 0) {
    try {
      if (cfg('HIDEHAND') === 1) {
        rider.addEffect('minecraft:invisibility', 600, { amplifier: 0, showParticles: false });
      } else if (rider.getEffect('minecraft:invisibility')) {
        rider.removeEffect('minecraft:invisibility');
      }
    } catch { /* effect API momentarily unavailable */ }
  }
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
  surfMemo.clear();

  clearLegacyAreas();
  // The scout starts at the player (a guaranteed-loaded chunk) and walks
  // itself east from there; its ticking bubble immediately covers the start
  // corridor -- including the rig position the launch poller waits on.
  try {
    const sc = dim.spawnEntity(SCOUT_TYPE, { x: startX + 0.5, y: SCOUT_Y, z: S.centerZ + 0.5 });
    sc.addTag(TAG_SCOUT);
    S.scoutId = sc.id;
  } catch (e) {
    say(`§eCould not summon the chunk scout (${e}). The ride still works, but the track will build much less far ahead -- make sure BOTH Infinite Rail packs are installed and up to date.`);
  }

  S.paceSpeed = 0;
  S.targetSpeed = cfg('MAXSPEED') / 20;
  S.fast = false;
  dbg(`default ride speed set to §f${cfg('MAXSPEED')}§7 blocks/s`);

  // Wait (up to ~50 s) for the ticking area to load/generate both the start
  // column and the rig position (startX + .CAMAHEAD, where the ride cart
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
    try {
      beginPhase2(startX);
    } catch (e) {
      reportError('ride start', e);
      abortLaunch('an internal error -- see the message above.');
    }
  }, 5);
}

// A launch that cannot finish must clean up after itself: remove the scout
// it summoned and persist the state it already mutated (autodone stays
// latched, started stays false), so nothing is leaked and a fresh start
// command works. Java's begin() is synchronous and cannot abort half-way.
function abortLaunch(reason) {
  say(`§cRide start aborted: ${reason}`);
  const scout = findScout();
  if (scout) { try { scout.remove(); } catch { /* already gone */ } }
  S.scoutId = '';
  saveState();
}

function beginPhase2(startX) {
  const player = findRider();
  if (!player) { abortLaunch('the starting player left.'); return; }

  // Initial rail elevation = terrain surface here + hover altitude.
  const surf = surfaceY(startX, S.centerZ);
  if (surf === undefined) {
    say('§eWarning: the terrain probe returned nothing at the start position. If the track never follows the landscape, report this with your Minecraft version.');
  }
  S.railY = (surf ?? Math.floor(player.location.y)) + cfg('HOVER');
  S.avg = S.railY - cfg('HOVER');

  // Initialize the shared brain's event-model state, exactly as begin does on
  // Java: flat, with a large flat-gap so the first slope is unrestricted.
  brainSet('slope', 0);
  brainSet('flat', 99);
  brainSet('lastDir', 0);
  brainSet('railY', S.railY);
  // Fresh carve-mode state (see decide): no slope buffer, no pending retro.
  brainSet('vclear', 0);
  brainSet('retro', 0);

  // Track history: one rail-Y per column; the camera's whole map of the path.
  S.trackY = [S.railY];
  S.trackBase = startX;

  // First column + the virtual pace cart parked on it (full clear: no decide
  // has run yet, matching Java's begin, where .veg starts at 0).
  try { placeColumn(startX, S.railY, 0, false); } catch { /* still generating; loop heals it */ }
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

  // The camera rig: the invisible seat (the mover) carries the cart prop
  // and the player as SIBLING passengers -- cart in seat 0 (offset zero),
  // player in seat 1 (0.35 up, sitting in the cart visual). Siblings, not
  // a stack: re-seating one can then never eject the other, which is what
  // turned the old seat->cart->player chain into a per-tick mount war
  // whenever mount state misread. The player mounts once (mount events
  // flash the client's un-hideable dismount hint, so the keeper only ever
  // re-mounts after a genuine, positionally-confirmed dismount).
  S.s2 = S.railY;
  const sy = camFollow() ?? S.railY;
  const rigPos = {
    x: S.paceX + cfg('CAMAHEAD'),
    y: sy + CART_REST + cfg('CAMHEIGHT') / 10,
    z: S.centerZ + 0.5,
  };
  try {
    spawnRig(rigPos);
    mountRider();
  } catch (e) {
    // Rig chunk still not generated after the 50 s wait, the player portaled
    // away mid-launch, or the seat entity is unavailable: give up cleanly
    // instead of dying half-done, and say which it was.
    abortLaunch(`could not spawn the ride rig (${e}). If the terrain was still generating, run the start command again; otherwise make sure BOTH Infinite Rail packs (behavior + resource) are active and check the Content Log.`);
    return;
  }

  // Spectator constraints: look freely, feel nothing. SURVIVAL, not
  // adventure: Bedrock does not naturally spawn mobs around adventure-mode
  // players, which made the whole ride eerily lifeless -- survival keeps the
  // world populated (animals AND hostiles; they can't hurt the rider through
  // Resistance 255 + the damage gamerules, can't grief through mobGriefing
  // false, and can't enter the rig). Breaking blocks stays a non-issue: the
  // inventory keeper leaves nothing to place or swing, and the ride glides
  // past faster than anything could be punched out. (Java keeps adventure --
  // its spawning doesn't care about game mode.)
  try {
    player.runCommand('gamemode survival @s');
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
    // Take the Settings book (the mode-menu item) back -- the ride is over.
    try {
      const inv = rider.getComponent('minecraft:inventory')?.container;
      const cur = inv?.getItem(SETTINGS_SLOT);
      if (cur && cur.typeId === SETTINGS_ITEM && cur.nameTag === SETTINGS_NAME) {
        inv.setItem(SETTINGS_SLOT, undefined);
      }
    } catch { /* inventory unavailable */ }
  }
  S.camActive = false;
  // Remove EVERY rig piece wearing our tags (there should be one of each, but
  // stale sessions may have left extras behind). Each type is collected under
  // its own guard so one unregistered type (e.g. an outdated BP without the
  // scout) can't abort the whole sweep.
  if (dim) {
    const collect = (type, tag) => {
      try { return dim.getEntities({ type, tags: [tag] }); } catch { return []; }
    };
    const pieces = [
      ...collect(SEAT_TYPE, TAG_SEAT),
      ...collect(CART_TYPE, TAG_RIDE),
      ...collect('minecraft:minecart', TAG_RIDE), // vanilla fallback / pre-1.0.6 rides
      ...collect(SCOUT_TYPE, TAG_SCOUT),
    ];
    for (const e of pieces) {
      try { e.getComponent('minecraft:rideable')?.ejectRiders(); } catch { /* empty */ }
      try { e.remove(); } catch { /* already gone */ }
    }
    clearLegacyAreas();
  }
  S.cartId = '';
  S.seatId = '';
  S.scoutId = '';
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
  // Leg 1: are API-written scores visible to commands (and vice versa)?
  let apiOk = false;
  try {
    setScore('bt', 41);
    runCmd(`scoreboard players add ${P}bt ir 1`);
    apiOk = getScore('bt', -1) === 42;
  } catch { /* apiOk stays false */ }

  if (!apiOk) {
    // Verify the command-only path round-trips before committing to it.
    runCmd(`scoreboard players set ${P}bt ir 7`);
    const r = runCmd(`execute if score ${P}bt ir matches 7 run scoreboard players add ${P}probe ir 1`);
    if ((r?.successCount ?? 0) > 0) {
      bridgeMode = 'cmd';
      say('§eCompatibility: this version splits the script and command scoreboards -- switching to the command bridge. Live ".KNOB" scoreboard tweaks will read as config-file defaults.');
    } else {
      say('§cSELF-TEST FAILED: neither the API nor the command bridge can reach the scoreboard. The ride cannot follow terrain -- please report this with your Minecraft version.');
      return;
    }
  }

  // Leg 2: the shared brain must answer through the chosen bridge. In api
  // mode everything the test touches is snapshotted and restored; in cmd mode
  // scores can't be read back, so the test only runs when no ride is active
  // (clobbering a fresh brain's state is harmless -- it is re-seeded below).
  if (bridgeMode === 'cmd' && S.started) return;
  const touched = ['slope', 'flat', 'lastDir', 'target', 'railY', 'dir',
    'diff', 'slope0', 'want', 'need', 'ndead', 'nOne', 'bt',
    'gfloor', 'gmax', 'gcone', 'dig', 'dig2', 'push', 'due', 'cgate',
    'glim', 'glift', 'rnext'];
  const snap = {};
  if (bridgeMode === 'api') {
    for (const k of touched) snap[k] = getScore(k, undefined);
  }

  let brainOk = false;
  try {
    brainSet('slope', 0);
    brainSet('flat', 99);
    brainSet('lastDir', 0);
    brainSet('target', 100);
    brainSet('railY', 90);
    brainSet('dir', 0);
    // Neutral near-scan inputs (their fail-open sentinels): a stale .gcone
    // from a previous ride would otherwise hold the test climb back.
    brainSet('gfloor', -10000);
    brainSet('gmax', -10000);
    brainSet('gcone', 32000);
    runCmd(`function ${NS}/decide`);
    brainOk = brainGetDir() === 1; // a wanted 10-block climb must answer dir=1
  } catch { /* reported below */ }

  if (bridgeMode === 'api') {
    for (const k of touched) {
      if (snap[k] === undefined) {
        try { objective().removeParticipant(P + k); } catch { /* never existed */ }
      } else {
        setScore(k, snap[k]);
      }
    }
    runCmd(`scoreboard players reset ${P}bt ir`);
  } else {
    // cmd mode, no active ride: re-seed begin()'s initial brain state.
    brainSet('slope', 0);
    brainSet('flat', 99);
    brainSet('lastDir', 0);
  }

  if (!brainOk) {
    say('§cSELF-TEST FAILED: the shared decide function did not answer (the track would stay flat). Check the Content Log for errors loading infinite_rail functions and report this.');
  } else {
    dbg(`bridge self-test OK (mode: ${bridgeMode})`);
  }
}

function init() {
  dim = world.getDimension('overworld');
  objective();

  AIR = BlockPermutation.resolve('minecraft:air');
  RAIL_FLAT = BlockPermutation.resolve('minecraft:golden_rail', { rail_direction: 1, rail_data_bit: true });
  RAIL_UP = BlockPermutation.resolve('minecraft:golden_rail', { rail_direction: 2, rail_data_bit: true });
  RAIL_DOWN = BlockPermutation.resolve('minecraft:golden_rail', { rail_direction: 3, rail_data_bit: true });
  // The smooth-stone-look power block (see placeColumn); a bare redstone
  // block does the same job undisguised if this BP is somehow outdated.
  try { SUPPORT = BlockPermutation.resolve('infinite_rail:support'); }
  catch { SUPPORT = BlockPermutation.resolve('minecraft:redstone_block'); }
  // A standing torch for torch mode (maybeTorch).
  try { TORCH = BlockPermutation.resolve('minecraft:torch', { torch_facing_direction: 'top' }); }
  catch { TORCH = BlockPermutation.resolve('minecraft:torch'); }

  // Apply the tunable knobs from the SHARED config.mcfunction (the same file
  // Java runs from load.mcfunction). Editing config + /reload refreshes them
  // mid-ride, exactly like Java.
  const r = runCmd(`function ${NS}/config`);
  if (r === undefined) {
    say('§cconfig function failed to run -- using built-in defaults. Is the behavior pack fully installed?');
    for (const [k, v] of Object.entries(CONFIG_DEFAULTS)) {
      if (getScore(k, undefined) === undefined) setScore(k, v);
    }
  }
  // Seed the ride-mode toggle scores (0 = off) if they've never been set --
  // the shared modes_init, same call Java makes from load.mcfunction. Modes
  // are state, not config: they live outside config.mcfunction so a /reload
  // never resets an enabled mode.
  runCmd(`function ${NS}/modes_init`);

  loadState();
  if (S.started) say('§7Ride resumed. Run §b/function infinite_rail/stop§7 to end it.');
  else say('§7Loaded. A fresh world starts the ride automatically; run §b/function infinite_rail/start§7 to (re)start it here.');
  inited = true;

  // The self-test runs LAST, fully guarded, and after inited is set: it is a
  // diagnostic (and the bridge-mode chooser), and no diagnostic may ever be
  // the thing that breaks startup.
  try { bridgeTest(); } catch (e) { reportError('self-test', e); }
}

// init() is called from worldLoad, but also lazily from the tick driver and
// the command bridge below: after a /reload the script module re-evaluates
// without a fresh worldLoad event, and the ride must come back regardless.
// A persistent init failure is REPORTED (rate-limited), never swallowed --
// a silently dead script is indistinguishable from an uninstalled pack.
function ensureInit() {
  if (inited) return true;
  try { init(); } catch (e) {
    if (tickN > 40) reportError('startup', e); // give the world a 2s grace to actually load
  }
  return inited;
}

world.afterEvents.worldLoad.subscribe(ensureInit);

system.afterEvents.scriptEventReceive.subscribe((ev) => {
  try {
    if (!ensureInit()) { say('§cThe pack is not initialized yet -- see any error above.'); return; }
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
  } catch (e) {
    reportError('start/stop command', e);
  }
}, { namespaces: [NS] });

// The Settings book: using it (right-click / hold) opens the native mode
// menu. itemUse fires for a plain book because it has no vanilla use action
// competing for the interaction; matched by type + name + rider so nothing
// else can trigger it.
world.afterEvents.itemUse.subscribe((ev) => {
  try {
    if (!inited || !S.started) return;
    const item = ev.itemStack;
    if (!item || item.typeId !== SETTINGS_ITEM || item.nameTag !== SETTINGS_NAME) return;
    if (ev.source?.typeId !== 'minecraft:player' || ev.source.name !== S.riderName) return;
    showMenu(ev.source);
  } catch (e) {
    reportError('settings menu', e);
  }
});

system.runInterval(() => {
  tickN += 1;
  try { tick(); } catch (e) { reportError('tick', e); }
});

function tick() {
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
  tickScout();                      // 1b. keep terrain open ahead of the head
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
      } else if (S.rigMissing > 200 && sy !== undefined) {
        // The rig chunk refuses to load (e.g. the rider respawned far from
        // it and nothing else loads that area anymore): bring the rider to
        // the rig position -- their presence loads the chunk, and the next
        // ticks respawn the rig and re-seat them.
        const rider = findRider();
        if (rider && ridingMode(rider.getGameMode())
          && !rider.getComponent('minecraft:riding')) {
          try {
            rider.teleport({ x: rigX, y: sy + 2, z: S.centerZ + 0.5 });
          } catch { /* retry on a later tick */ }
        }
      }
    }
  } else {
    S.rigMissing = 0;
  }
  if (seat && cart) {
    keepers(seat);                  // 2-4. eject strangers, re-seat the rider
    const sy = camFollow();         // 6.  the smoothed rail-line height
    if (sy !== undefined) camMove(seat, cart, sy); // glide seat + cart prop
  }
  buildLoop();                      // 7.  extend the track

  if (--saveCountdown <= 0) { saveState(); saveCountdown = 40; }
}
