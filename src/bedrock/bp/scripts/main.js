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
//      + #infinite_rail:not_terrain dig-down       + walk down past foliage and
//      (only way to read heightmaps into           not-terrain blocks (trees,
//       scoreboards)                               village houses) + climb back
//                                                  up liquid columns (Bedrock's
//                                                  topmost probe skips liquids
//                                                  entirely)
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
//    forceload macro                           ->  a rolling script ticking-
//                                                  area corridor
//                                                  (world.tickingAreaManager,
//                                                  @minecraft/server 2.6.0),
//                                                  which loads AND generates
//                                                  its chunks server-side --
//                                                  unlike /tickingarea, and
//                                                  unlike the retired
//                                                  tick_world scout entity
//                                                  it replaces
//
//  The per-column pipeline is IDENTICAL to Java's advance.mcfunction:
//    1. sampleWindow() -> average surface of the next .SAMPLE_WINDOW blocks
//       (one sample every .SAMPLE_BLOCK_INTERVAL,
//       clamped at most DOWNCLAMP below the average, void reads fall back)
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

import { world, system, BlockPermutation, BlockVolume, EasingType, GameMode, ItemStack, WeatherType } from '@minecraft/server';
// The native pop-ups used by the settings items' menus (ModalForm) and the
// Tips item's read-only page (ActionForm). Safe as a static import: the
// manifest declares the @minecraft/server-ui 2.0.0 dependency (stable well
// before this pack's 1.21.120 floor), so the module is always provided
// wherever the pack loads at all.
import { ActionFormData, ModalFormData } from '@minecraft/server-ui';
import { camHeight } from './cam_math.js';
// The vegetation the carve spares -- Bedrock's own hand-maintained list
// (keep it in sync with Java's tags/block/keep.json, the other edition's
// realization of the same policy). Bedrock commands have no block tags, so
// the classification runs at runtime instead.
import { isVegetation } from './vegetation.js';
// What the surface probe must NOT count as terrain -- vegetation plus
// man-made structure blocks (village houses etc.); probeSurface() digs down
// through these to the real ground. The pair of Java's
// tags/block/not_terrain.json, hand-maintained in policy sync like the
// vegetation pair.
import { isNotTerrain } from './not_terrain.js';

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
// The rolling ticking-area CORRIDOR -- two alternating area names, so each
// roll can claim the new span BEFORE releasing the old one (the overlap
// never unloads; a one-name design would drop and reload the whole span).
const CORR_A = 'ir_corr_a';
const CORR_B = 'ir_corr_b';
// How far behind the RIG the corridor's tail reaches. The rider's own
// simulation bubble covers the rig on real worlds; the tail is what keeps
// headless (surrogate) rides self-sufficient and gives the rig chunks a
// margin on laggy rejoins.
const CORR_BEHIND = 24;
// Per-area chunk cap. world.tickingAreaManager allows 300 ticking chunks
// per pack, and the A/B handoff briefly holds BOTH corridors -- capping one
// corridor at 140 keeps the overlap safely inside the budget (the cap only
// binds at extreme torch widths; corridorOptions() trims the LENGTH to fit,
// never below the sample window the builder needs).
const CORR_BUDGET = 140;
// How far past the head buildReady() requires loaded chunks (the first
// third of the default 48-block .SAMPLE_WINDOW; the rest may lag and fall
// back per-sample).
const BUILD_MARGIN = 17;
const PREFIX = '§6[Scenic Rail]§r ';
const DBG = '§3[SR Debug]§r ';

// The PINNED HOTBAR ITEMS -- kept in place by the inventory keeper (which
// clears everything else every tick) and matched by type + name in the
// use handlers, so a random picked-up item could never trigger them.
// Mirrors Java's give_menu slot for slot -- settings menus far left, Debug
// far right, the speed trio (-, Reset, +) in between (Reset dead center at
// slot 4) -- plus one Bedrock-only extra Java has no use for: the Toggle
// HUD item at slot 2 (a Java ride is always on a PC, where F1 hides the
// HUD; /hud is Bedrock's command):
//   0  "Ride Settings"    opens the native ride form (speed, sky, sound, hide cart, mobs aggro)
//   1  "Visual Settings"  opens the native visual form (rain, storms, time, torches, track light)
//   2  "Toggle HUD"   hides the HUD except the item-name popup / restores it
//                     (runs infinite_rail/hud_toggle -- Bedrock-only, Java
//                     riders have F1; an item PAIR: crossed-out-eye icon
//                     while the HUD shows, swapped for the fully transparent
//                     variant while hidden, so nothing is held during the
//                     clean view -- see toggleHud)
//   3  "Speed -"      one notch slower down the speed grid (runs infinite_rail/speed_dec)
//   4  "Speed Reset"  back to the default ride speed (runs infinite_rail/speed_reset) -- dead center of the bar
//   5  "Speed +"      one notch faster up the speed grid (runs infinite_rail/speed_inc)
//   7  "Tips"      opens the recommended-settings page
//   8  "Debug"     opens the native debug form (chat output, sidebar views)
// The MENU items are placeable vanilla blocks/carts chosen for their icons
// (the smithing table, the soul campfire, the chest minecart), so a use can
// arrive through TWO events: itemUse (aiming at air) and
// playerInteractWithBlock (aiming at a block -- which must also be
// CANCELLED before the survival rider builds the icon into the world). The
// SPEED trio are the pack's own non-placeable items (see the PINNED note
// below) so nothing can ever be built OR client-predicted, but their block-
// aimed clicks still arrive through the same interact event. Both paths
// funnel through handlePinnedUse with a debounce. Java's twins are clickable
// written books + re-modeled carrot_on_a_sticks (give_menu.mcfunction) since
// Java has no native forms.
//
// Deliberately NOT slot-locked (ItemLockMode.slot): Bedrock decorates
// locked items with a lock badge and a "Can't be moved / dropped /
// removed / crafted with" tooltip block, which reads as clutter. The
// inventory keeper re-pins every item every tick, so a moved or dropped
// one heals itself within a tick anyway.
const RIDE_NAME = '§6Ride Settings';
const VISUAL_NAME = '§bVisual Settings';
const HUD_NAME = '§dToggle HUD';
const TIPS_NAME = '§eTips';
const DEBUG_NAME = '§3Debug';
const SPEED_UP_NAME = '§aSpeed +';
const SPEED_DOWN_NAME = '§cSpeed -';
const SPEED_RESET_NAME = '§eSpeed Reset';
// The SPEED trio are the pack's OWN items (bp/items/speed_*.json), pure
// non-placeable icons whose sprites the RP maps onto the vanilla rail /
// minecart / powered-rail item textures (textures/item_texture.json, the
// no-texture-shipped trick). They used to be the real vanilla items, which
// are PLACEABLE -- so every click aimed at a block within reach (the track
// is right under the crosshair) had the client PREDICT the placement
// (minecart onto the powered rail below was the worst: the hotbar stack
// visibly emptied) before the cancelled interact event rolled it back with
// a full hotbar resync -- and a resync racing the mouse wheel EATS scroll
// input, which is exactly the "scrolling around the middle Speed item needs
// two notches" bug. A custom item with no block gives the client nothing to
// predict: no rollback, no resync, no eaten scrolls. `fallback` is the old
// vanilla item, used only if this engine somehow can't resolve the custom
// id (mismatched/outdated pack pair) -- and still matched by the use
// handlers so a stale save's old items keep working until the keeper
// swaps them. "Toggle HUD" is the pack's own too -- a PAIR of plain
// non-placeable custom items sharing one hotbar slot, picked by HUD state:
// toggle_hud_shown (bp/items/toggle_hud_shown.json, the visible ir_hide_hud
// crossed-out-eye icon) is pinned while the HUD is VISIBLE, and toggle_hud
// (bp/items/toggle_hud.json, the FULLY TRANSPARENT ir_blank.png icon --
// a flat item with zero opaque pixels renders as NOTHING in hand) swaps in
// while the HUD is HIDDEN, so the parked-on-this-slot clean view holds
// nothing visible exactly when the clean view is on. The swap is the
// keeper's normal mismatch re-pin (pinnedItemType answers by hudHiddenNow),
// so it fires ONCE per HUD toggle -- a deliberate click, wheel at rest --
// and steady state stays write-silent: nothing per-scroll or per-equip for
// the mouse wheel to race. That ordering matters -- the invisible-in-hand
// job was first done by an RP attachable binding empty geometry, and an
// attachable is re-instantiated on EVERY equip, i.e. every hotbar scroll
// onto/off its slot; that per-equip churn ate scroll notches (re-boning the
// geometry didn't help -- the attachable mechanism itself was the problem).
// RULE OF THUMB from the two scroll-eating bugs this hotbar has had: a
// pinned item must be a plain NON-PLACEABLE custom item with NO attachable,
// and hotbar writes must correlate with CLICKS, never with scrolling --
// anything the client re-evaluates around a hotbar slot (placement
// prediction, attachable re-instantiation, mid-scroll resyncs) races the
// mouse wheel. The pair has NO vanilla fallback ON PURPOSE: a stand-in
// HIDES the real problem (a pack install missing bp/items/ -- the
// shadow-tree symlink bug -- shipped as a mystery amethyst instead of a
// diagnosis). If one variant's id doesn't resolve (a half-updated
// registry), pinnedItemType falls back to the OTHER variant; if neither
// resolves, the slot stays EMPTY and customItemOk warns in chat naming the
// id.
const PINNED = [
  { slot: 0, type: 'minecraft:chest_minecart', name: RIDE_NAME, lore: ['§7Use to open the', '§7ride settings menu'] },
  { slot: 1, type: 'minecraft:soul_campfire', name: VISUAL_NAME, lore: ['§7Use to open the', '§7visual settings menu'] },
  // altType = the HUD-hidden variant (blank icon, held as nothing); `type` is
  // the HUD-visible one. pinnedItemType picks per tick via hudHiddenNow().
  { slot: 2, type: 'infinite_rail:toggle_hud_shown', altType: 'infinite_rail:toggle_hud', name: HUD_NAME, lore: ['§7Hide or show the HUD'] },
  { slot: 3, type: 'infinite_rail:speed_down', fallback: 'minecraft:rail', name: SPEED_DOWN_NAME, lore: ['§7Ride speed down'] },
  { slot: 4, type: 'infinite_rail:speed_reset', fallback: 'minecraft:minecart', name: SPEED_RESET_NAME, lore: ['§7Reset the ride speed', '§7to the default'] },
  { slot: 5, type: 'infinite_rail:speed_up', fallback: 'minecraft:golden_rail', name: SPEED_UP_NAME, lore: ['§7Ride speed up'] },
  { slot: 7, type: 'minecraft:book', name: TIPS_NAME, lore: ['§7Recommended settings', '§7for the best ride'] },
  { slot: 8, type: 'minecraft:smithing_table', name: DEBUG_NAME, lore: ['§7Use to open the', '§7debug menu'] },
];
// Slot -> pinned def, so the per-tick inventory keeper indexes instead of
// scanning PINNED per slot.
const PINNED_BY_SLOT = [];
for (const d of PINNED) PINNED_BY_SLOT[d.slot] = d;

// Which id a def actually pins: the custom item normally, the vanilla
// fallback if THAT custom id doesn't resolve on this engine. Probed PER ID
// -- one missing id must not drag the working ones down to their placeable
// vanilla stand-ins (that would resurrect the eaten-scroll bug for the
// speed trio the moment anything newer is missing), and the ids can
// genuinely differ in age: /reload refreshes functions and scripts but NOT
// item definitions, so a world updated without a full quit-and-rejoin has
// the NEW script asking for an item its registry has never heard of.
// A successful probe is cached for the session; a FAILED one is re-probed
// every ~30 s (a slow registry at world load heals mid-session; a stale
// one heals on rejoin). The keeper compares against the same cached
// answer, so a fallback world never enters a replace-every-tick war. The
// combined answer (over every pack-own id, fallback or not -- the Toggle
// HUD item deliberately has none, see PINNED) is mirrored to the .itemsok
// score (the test suite asserts it) and the first failure warns in chat,
// loudly and specifically -- silent degradation hid a broken install for
// months: a dev shadow tree that never linked bp/items/ ran every ride on
// the lookalike speed fallbacks, undetectable until the Toggle HUD item's
// then-fallback surfaced as a mystery amethyst.
const itemProbe = new Map(); // custom id -> { ok, at (tick of last probe) }
let itemWarned = false;
function customItemOk(id) {
  const c = itemProbe.get(id);
  if (c && (c.ok || tickN - c.at < 600)) return c.ok;
  let ok = false;
  try { void new ItemStack(id, 1); ok = true; } catch { ok = false; }
  itemProbe.set(id, { ok, at: tickN });
  try {
    setScore('itemsok', PINNED.every((d) => [d.type, d.altType].every((t) => !t || !t.startsWith(`${NS}:`) || itemProbe.get(t)?.ok)) ? 1 : 0);
  } catch { /* scoreboard not ready this early */ }
  if (!ok && !itemWarned) {
    itemWarned = true;
    say(`§eThe pack's own hotbar item §f${id}§e didn't resolve -- its behavior-pack definition (bp/items/) is not in this world's item registry, so its hotbar slot stays empty (or a vanilla stand-in is pinned where one exists). Make sure the FULL, current behavior pack is installed -- a dev symlink tree must link the items folder -- then quit and rejoin the world (/reload alone does not refresh item definitions).`);
  }
  return ok;
}
// Is the HUD currently hidden by the Toggle HUD item? Drives which of the
// slot-2 pair the keeper pins. The .HUDHIDDEN score is authoritative where
// the API can read it; on cmd-bridge worlds (split scoreboards -- the read
// lies) the script's own S.hudHidden mirror, flipped by toggleHud and
// persisted with the ride state, answers instead (a chat-run hud_toggle
// desyncs the mirror there -- cosmetic only, the next item click realigns).
function hudHiddenNow() {
  if (bridgeMode === 'api') return getScore('HUDHIDDEN', 0) === 1;
  return !!S.hudHidden;
}

function pinnedItemType(def) {
  if (def.altType) {
    // The Toggle HUD pair: `type` while the HUD is visible, `altType` (the
    // blank held-as-nothing variant) while it is hidden. A half-updated
    // registry that resolves only one variant degrades to that variant
    // (still non-placeable, still matched by the use handlers) instead of
    // throwing the keeper into a re-pin loop.
    const primary = hudHiddenNow() ? def.altType : def.type;
    const other = primary === def.type ? def.altType : def.type;
    if (customItemOk(primary)) return primary;
    if (customItemOk(other)) return other;
    return def.type; // neither resolves: makePinnedItem throws, slot stays empty + warning
  }
  if (!def.fallback) return def.type;
  return customItemOk(def.type) ? def.type : def.fallback;
}

function makePinnedItem(def) {
  const item = new ItemStack(pinnedItemType(def), 1);
  item.nameTag = def.name;
  item.setLore(def.lore);
  return item;
}

// How fast the virtual pace position eases between speed targets, in
// blocks/second per tick. Java gets its acceleration for free from powered-rail
// physics; this reproduces a similar gentle ramp (8 -> 32 blocks/s in ~3 s).
const ACCEL = 0.4;
// The brisk ramp used when the TARGET ITSELF was changed by the user (a
// Speed -/Reset/+ click or the settings slider) rather than by a context
// switch (ocean sprint in/out, sky mode on/off). Java applies a click
// straight to the minecart max-speed gamerule -- deceleration there is
// near-instant -- so the virtual pace matches: a 32 -> 8 reset lands in
// ~0.5 s instead of the 3 s context ramp. Context switches keep the gentle
// ACCEL above: those model Java's own rail-physics accelerations, and
// gradual is the point there.
const ACCEL_CLICK = 2.5;

// The ride cart rests this far above the smoothed rail line, like a real cart
// on a rail (Java uses the same 62 milliblocks in cam_move).
const CART_REST = 0.062;

// Hide-minecart mode's cart offset, in tenths of a block (the .CARTYOFF
// scale): while .HIDECART is on, camMove glides the cart prop at this fixed
// offset INSTEAD of .CARTYOFF, sinking it below the track line where the
// track blocks hide it from the rider's perspective. Toggling off simply
// resumes reading the config .CARTYOFF, so "restore" is automatic.
const HIDE_CARTYOFF = -5;

// In-memory track history is trimmed behind the ride so an endless ride can't
// grow memory forever (the camera only ever reads a few hundred columns
// around the rig). Java's hist_trim bounds its storage list at the same 2048.
const HIST_MAX = 2048;
// How many trailing history entries are persisted for seamless world rejoins.
const HIST_PERSIST = 1024;

// Everything the shared config.mcfunction sets, with its default, so the
// script can survive a wiped scoreboard and knows what to read. Values are
// re-read from the scoreboard every tick, so live "/scoreboard players set
// .HOVER ir 8" tweaks work mid-ride exactly like Java.
const CONFIG_DEFAULTS = {
  HOVER: 2, TUNNELCLEAR: 6, CAMHEIGHT: 0, CAMBLEND: 6, CAMSMOOTH: 6, CAMLIFT: 20,
  RIDER_BEHIND: 160, CAMMODE: 0, CARTYOFF: 12, AUTOSTART: 1,
  DEFAULTSPEED: 8, OCEANSPEED: 32, OCEANCHUNKS: 6, LANDCHUNKS: 3, MIN_CHANGE: 4,
  SAMEGAP: 75, TURNGAP_TOP: 60, TURNGAP_BOTTOM: 100, GAPRATIO: 50, GAPMATCH: 75,
  SLOPECLEAR: 6, DOWNCLAMP: 30,
  UPGRACE: 20, DOWNLOOK_AHEAD: 250, PLOW_GRACE_UP: 1, PLOW_GRACE_DOWN: 1,
  SHIFT_REQ_BOTTOM: 30, SAMPLE_WINDOW: 75, SAMPLE_BLOCK_INTERVAL: 1,
  PACE_CART_BEHIND: 224, TERRAIN_GENAHEAD: 192, BUILD_FACTOR: 3, DEBUGMODE: 0,
  SKYY: 120, SKYSPEED: 18, TORCHODDS: 35, TORCHRANGE: 30, SEAPICKLE: 4,
  CARTSOUND: 0, MOBAGGRO: 0, NOSTORMS: 0, WORLDAGEWARN: 15,
};

// The rig's lead over the virtual pace position, derived from the two
// head-relative distance knobs (every distance in the config is measured
// from the build head): the pace rides .PACE_CART_BEHIND behind the head,
// the rider .RIDER_BEHIND, so the rig leads the pace by the difference
// (64 at the defaults -- the old .CAMAHEAD).
function camAhead() {
  return cfg('PACE_CART_BEHIND') - cfg('RIDER_BEHIND');
}

// Which objective each knob lives in. The tunables are split into three
// sidebar-sized groups (a vanilla sidebar shows ONE objective, max 15 rows)
// so the Debug menu can display any whole group; .DEBUGMODE/.AUTOSTART stay
// in `ir` with the runtime state. Must match config.mcfunction and Java's
// load.mcfunction.
const CFG_GROUPS = {
  // (.SAMPLE_BLOCK_INTERVAL lives in `ir` with .DEBUGMODE/.AUTOSTART --
  // cfg_terrain is back at the 15-row sidebar cap.)
  cfg_terrain: ['HOVER', 'TUNNELCLEAR', 'MIN_CHANGE', 'SAMEGAP', 'TURNGAP_TOP',
    'TURNGAP_BOTTOM', 'GAPRATIO', 'GAPMATCH', 'SLOPECLEAR', 'DOWNCLAMP',
    'UPGRACE', 'DOWNLOOK_AHEAD', 'PLOW_GRACE_DOWN', 'PLOW_GRACE_UP',
    'SAMPLE_WINDOW'],
  cfg_camera: ['CAMHEIGHT', 'CAMBLEND', 'CAMSMOOTH', 'CAMLIFT', 'RIDER_BEHIND',
    'CAMMODE', 'CARTYOFF'],
  cfg_ride: ['DEFAULTSPEED', 'OCEANSPEED', 'OCEANCHUNKS', 'LANDCHUNKS', 'SKYY',
    'SKYSPEED', 'TORCHODDS', 'TORCHRANGE', 'SEAPICKLE', 'SHIFT_REQ_BOTTOM',
    'PACE_CART_BEHIND', 'TERRAIN_GENAHEAD', 'BUILD_FACTOR', 'CARTSOUND',
    'MOBAGGRO'],
};
const CFG_OBJ = {}; // knob name -> objective id (defaults to OBJ)
for (const [obj, keys] of Object.entries(CFG_GROUPS)) {
  for (const k of keys) CFG_OBJ[k] = obj;
}
// Every objective the pack uses, with the sidebar display name it is created
// with (`dbg` is the Debug menu's curated live-state mirror -- display-only;
// `dbg_live` is the Bedrock-only per-tick rig & tick diagnostics view).
const OBJ_DISPLAY = {
  ir: 'ir',
  cfg_terrain: 'Terrain settings',
  cfg_camera: 'Camera settings',
  cfg_ride: 'Ride settings',
  dbg: 'Live state',
  dbg_live: 'Live diag',
};

// The vanilla ocean biomes the speed-up counts (Bedrock has no biome tags,
// so Java's tag check becomes an explicit id set; deep_warm_ocean exists
// only on Bedrock). The FROZEN oceans (frozen_ocean, deep_frozen_ocean,
// legacy_frozen_ocean) are deliberately absent -- they're treated like land:
// their icebergs and pack ice are scenery worth watching, not an empty
// stretch to sprint across (Java's ocean_check excludes them the same way).
const OCEAN_BIOMES = new Set([
  'minecraft:ocean', 'minecraft:deep_ocean',
  'minecraft:warm_ocean', 'minecraft:deep_warm_ocean',
  'minecraft:lukewarm_ocean', 'minecraft:deep_lukewarm_ocean',
  'minecraft:cold_ocean', 'minecraft:deep_cold_ocean',
]);

// Column block palette (resolved once). PLAIN rail on PLAIN smooth stone:
// nothing rides the physical track on Bedrock (the pace is virtual, the ride
// cart is velocity-driven scenery), so the old powered golden_rail + custom
// redstone-producer support -- and the two resource-pack texture disguises
// that made them LOOK plain -- were pure overhead: every placed support was
// a redstone source powering a rail for no one. rail_direction: 1 = flat
// east-west, 2 = ascending east, 3 = ascending west (same indices as the
// golden rail's); the light block is per-level flattened on current
// Bedrock. Consequence: a hand-placed cart on the leftover track coasts but
// no longer self-propels (Java keeps its genuinely powered rails).
let AIR, RAIL_FLAT, RAIL_UP, RAIL_DOWN, SUPPORT, TORCH;
// Sea pickle clusters for torch mode's water case (maybeTorch), indexed by
// pickle count 1..4 (SEA_PICKLE[0] is unused). Bedrock's sea_pickle uses
// cluster_count 0..3 for 1..4 pickles; dead_bit:false = the live, glowing
// state (surrounding water re-waterlogs it so it stays alive).
let SEA_PICKLE = null;
// The track light's per-level flattened ids (light_block_0 .. light_block_15);
// the level itself is the .LIGHTMODE state score (lightLevel() -- the Track
// light mode: 11 = bright/default, 8 = dim, 0 = none).
const LIGHT_BLOCK_PREFIX = 'minecraft:light_block_';

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
  riderName: '',   // the one player this ride belongs to ('' when riderId is set)
  riderId: '',     // entity id of a NON-PLAYER rider (a surrogate -- see begin)
  startTimer: 0,   // auto-start countdown (ticks with a player present)
  cartId: '',      // entity id of the ride cart (rediscovered by tag if stale)
  seatId: '',      // entity id of the camera seat (rediscovered by tag if stale)
  rigMissing: 0,   // consecutive ticks the rig has been missing (respawn grace)
  camActive: false, // whether the optional Camera API mode is currently applied
  teleportFallback: false, // set if applyImpulse is unavailable on the seat
  hudHidden: false, // script-side mirror of .HUDHIDDEN (hudHiddenNow's cmd-bridge answer; picks the slot-2 item variant)
  weather: '',     // last weatherChange's WeatherType as a string ('' = none seen) -- the sky read stormWatchNow answers from (no Dimension.getWeather in current @minecraft/server)
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

// Objective handles are memoized: the tick loop reads dozens of scores per
// tick (config knobs, mode flags, brain answers), and each read used to pay
// a world.scoreboard.getObjective() bridge call before the actual getScore.
// A handle only ever goes stale if something outside the pack removes the
// objective (/scoreboard objectives remove); the readers below drop the
// memo and refetch once on any throw, so even that heals on the next call.
const objMemo = new Map(); // objective id -> handle
function objective(id = OBJ) {
  let o = objMemo.get(id);
  if (!o) {
    o = world.scoreboard.getObjective(id)
      ?? world.scoreboard.addObjective(id, OBJ_DISPLAY[id] ?? id);
    objMemo.set(id, o);
  }
  return o;
}

function getScore(name, fallback, obj = OBJ) {
  // getScore is documented to throw; on some versions it throws for fake
  // players that have never been registered (rather than returning
  // undefined), so an unguarded read of a not-yet-set score can kill the
  // caller. Treat any throw exactly like "no score yet" -- after one retry
  // on a fresh objective handle, in case the memoized one went stale.
  try {
    const v = objective(obj).getScore(P + name);
    return v === undefined ? fallback : v;
  } catch {
    objMemo.delete(obj);
    try {
      const v = objective(obj).getScore(P + name);
      return v === undefined ? fallback : v;
    } catch {
      return fallback;
    }
  }
}

function setScore(name, value, obj = OBJ) {
  try {
    objective(obj).setScore(P + name, value | 0);
  } catch (e) {
    // stale memoized handle (objective removed externally): refetch once
    objMemo.delete(obj);
    objective(obj).setScore(P + name, value | 0);
  }
}

function cfg(name) {
  return getScore(name, CONFIG_DEFAULTS[name], CFG_OBJ[name] ?? OBJ);
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

// Is a ride-mode toggle on? (.SKYMODE / .SOUNDMODE / .HIDECART -- the 0/1
// modes the script acts on; rain and night are pure command files and never
// read here, and the tri-state torch mode has its own reader below.) The
// mode functions only flip scoreboard scores, so reads go through the same
// bridge as the brain flags: the native API normally, a successCount probe
// on cmd-bridge worlds -- cached for a second there, because tickPace asks
// every tick.
const modeCache = new Map(); // name -> { at, v }
function modeOn(name) {
  if (bridgeMode === 'api') return getScore(name, 0) === 1;
  const c = modeCache.get(name);
  if (c && tickN - c.at <= 20) return c.v;
  const v = (runCmd(`execute if score ${P}${name} ir matches 1 run scoreboard players add ${P}probe ir 1`)?.successCount ?? 0) > 0;
  modeCache.set(name, { at: tickN, v });
  return v;
}

// The tri-state time mode (.NIGHTMODE: 0 = default day/night cycle,
// 1 = night only, 2 = day only), read through the same bridge as the other
// mode flags -- two successCount probes on cmd-bridge worlds.
function nightMode() {
  if (bridgeMode === 'api') {
    const v = getScore('NIGHTMODE', 0);
    return v >= 0 && v <= 2 ? v : 0;
  }
  if ((runCmd(`execute if score ${P}NIGHTMODE ir matches 1 run scoreboard players add ${P}probe ir 1`)?.successCount ?? 0) > 0) return 1;
  if ((runCmd(`execute if score ${P}NIGHTMODE ir matches 2 run scoreboard players add ${P}probe ir 1`)?.successCount ?? 0) > 0) return 2;
  return 0;
}

// The tri-state torch mode (.TORCHMODE: 0 = off, 1 = always on, 2 = auto --
// torches only at night; the default, seeded by the shared modes_init).
// Read exactly like nightMode() -- two successCount probes on cmd-bridge
// worlds -- but cached ~1 s there, because advance() asks per column.
let tmCache = 0;
let tmCacheAt = -100;
function torchMode() {
  if (bridgeMode === 'api') {
    const v = getScore('TORCHMODE', 0);
    return v >= 0 && v <= 2 ? v : 0;
  }
  if (tickN - tmCacheAt <= 20) return tmCache;
  tmCacheAt = tickN;
  if ((runCmd(`execute if score ${P}TORCHMODE ir matches 1 run scoreboard players add ${P}probe ir 1`)?.successCount ?? 0) > 0) tmCache = 1;
  else if ((runCmd(`execute if score ${P}TORCHMODE ir matches 2 run scoreboard players add ${P}probe ir 1`)?.successCount ?? 0) > 0) tmCache = 2;
  else tmCache = 0;
  return tmCache;
}

// Should NEW columns get torches right now? Mode 1 always plants; the
// default auto mode 2 asks the SHARED torch_auto brain file, so the
// day/night window (dusk 12542 .. dawn 23459) lives in exactly one place
// (src/shared/functions/torch_auto.mcfunction) for both editions: the
// script hands it the world clock (.tod -- Java fetches its own with
// `time query daytime`, which Bedrock's execute can't store) and reads
// back the .torchlit answer through the same bridge as the brain flags.
// Cached ~1 s -- advance() asks once per column and the answer only moves
// with the world clock.
let litCache = false;
let litCacheAt = -100;
function torchLit() {
  const m = torchMode();
  if (m === 0) return false;
  if (m === 1) return true;
  if (tickN - litCacheAt <= 20) return litCache;
  litCacheAt = tickN;
  const tod = world.getTimeOfDay() | 0;
  brainSet('tod', tod);
  const r = runCmd(`function ${NS}/torch_auto`);
  if (r) {
    litCache = brainGetFlag('torchlit');
  } else {
    // The shared torch_auto file isn't in the function registry (a pack
    // update installed over the SAME manifest version leaves Bedrock's
    // registry stale -- the failure the settings forms also guard against).
    // Fall back to the same night window computed in script; keep these
    // numbers in sync with src/shared/functions/torch_auto.mcfunction.
    litCache = tod >= 12542 && tod <= 23459;
  }
  return litCache;
}

// The Track light level (.LIGHTMODE -- mode_light_on/low/off, or the Visual
// Settings form's dropdown: 11 = the bright line (the default), 8 = a dim
// glow, 0 = none -- dark tunnels and nights). Any hand-set 0..15 works in
// API-bridge mode; on cmd-bridge worlds the read degrades to the nearest
// preset (two successCount probes, cached ~1 s -- placeColumn asks per
// column, the torchMode() pattern).
let llCache = 11;
let llCacheAt = -100;
function lightLevel() {
  if (bridgeMode === 'api') {
    const v = getScore('LIGHTMODE', -1);
    return v < 0 ? 11 : Math.min(15, v);
  }
  if (tickN - llCacheAt <= 20) return llCache;
  llCacheAt = tickN;
  if ((runCmd(`execute if score ${P}LIGHTMODE ir matches 0 run scoreboard players add ${P}probe ir 1`)?.successCount ?? 0) > 0) llCache = 0;
  else if ((runCmd(`execute if score ${P}LIGHTMODE ir matches 8 run scoreboard players add ${P}probe ir 1`)?.successCount ?? 0) > 0) llCache = 8;
  else llCache = 11;
  return llCache;
}

// The ride's land cruising speed: the .speed state score (adjusted by the
// Speed +/- items and the Ride Settings form's slider; seeded from .DEFAULTSPEED by
// the shared modes_init, clamped 1..64 by the shared speed_step). Falls
// back to the config default where the score is unreadable (cmd-bridge
// worlds -- there live speed changes degrade to the config value, like
// every other live tweak).
function landSpeed() {
  const v = getScore('speed', 0);
  return v >= 1 ? v : cfg('DEFAULTSPEED');
}

// The ride's SKY cruising speed: the .skyspd state score (adjusted by the
// Speed +/- items and the Ride Settings form's slider WHILE SKY MODE IS ON;
// seeded from config .SKYSPEED by the shared modes_init, tuned through the
// shared speed_step). Falls back to the config default where the score is
// unreadable (cmd-bridge worlds), like landSpeed().
function skySpeed() {
  const v = getScore('skyspd', 0);
  return v >= 1 ? v : cfg('SKYSPEED');
}

// The ride's OCEAN cruise speed: the .ocnspd state score. On each ocean ENTRY
// oceanCheck recomputes it RAISE-ONLY -- max(.OCEANSPEED, landSpeed()) -- so
// the automatic speed-up never SLOWS a rider already faster than the ocean
// speed; the Speed items / the form's slider still tune it in both directions
// while the sprint is on (a tune sticks for that crossing). Seeded from config
// .OCEANSPEED by the shared modes_init; same unreadable-score fallback as the
// other two.
function oceanSpeed() {
  const v = getScore('ocnspd', 0);
  return v >= 1 ? v : cfg('OCEANSPEED');
}

// The speed the ride cruises at right now: the sky cruise while sky mode owns
// the ride, the ocean cruise during an ocean sprint, else the land speed. The
// single reader the pace + the form use so they can't disagree about which
// speed is live.
function activeSpeed() {
  if (modeOn('SKYMODE')) return skySpeed();
  return S.fast ? oceanSpeed() : landSpeed();
}

// The shared speed_step branches on the .fast score (the ocean sprint's
// context flag) -- on Java that scoreboard score IS the state, but here the
// sprint lives in S.fast, so every transition mirrors it into the `ir`
// objective for the brain to read. A command write, so it works on
// cmd-bridge worlds too.
function syncFast() {
  runCmd(`scoreboard players set ${P}fast ir ${S.fast ? 1 : 0}`);
}

// Torch-mode density: the .torchdens state score (the Visual Settings form's
// Low/Medium/High/Max presets -- the torch_density_* function files; seeded
// from config .TORCHODDS by the shared modes_init), read the same way as
// .speed. Falls back to the config default where the score is unreadable
// (cmd-bridge worlds -- there a chosen preset degrades to the config value,
// like every other live tweak).
const TORCH_DENSITY = [
  { fn: 'low', label: 'Low', v: 15 },
  { fn: 'medium', label: 'Medium (default)', v: 35 },
  { fn: 'high', label: 'High', v: 70 },
  { fn: 'max', label: 'Max', v: 100 },
];

// The Track light presets (the Visual Settings form's dropdown; index order
// matches Java's book row [Off] [Low] [On]). v = the .LIGHTMODE light level
// the mode_light_* function files set.
const LIGHT_PRESETS = [
  { fn: 'off', label: 'Off (dark tunnels & nights)', v: 0 },
  { fn: 'low', label: 'Low (dim glow)', v: 8 },
  { fn: 'on', label: 'On (bright, default)', v: 11 },
];
function torchDensity() {
  const v = getScore('torchdens', 0);
  return v >= 1 ? v : cfg('TORCHODDS');
}

// Route a speed change through the shared speed_step state machine (clamp
// 1..64 + default detection) by feeding it a delta, then let speed_msg
// report -- the same path as the +/- items and Java, so the feedback and
// the clamping can never drift apart. .spstep 0 keeps this OFF the
// selectable-speed grid: the settings slider is an absolute setter (delta =
// target - current), so its result must land on the exact value the user
// picked, not get snapped onto the 1..6/8/12/... grid the +/- items walk.
function adjustSpeed(delta) {
  runCmd(`scoreboard players set ${P}spstep ir 0`);
  runCmd(`scoreboard players set ${P}spdir ir ${delta | 0}`);
  runCmd(`function ${NS}/speed_step`);
  runCmd(`function ${NS}/speed_msg`);
}

// The native settings menus (@minecraft/server-ui), split in two like
// Java's book pair -- "Ride Settings" (how the ride moves and sounds) and
// "Visual Settings" (what the world looks like). Each is one ModalFormData
// pre-set from the live scores, applied on submit by running the same
// mode_* / speed function files the chat commands use -- so the menus, the
// commands and Java behave identically, tellraw feedback included. Only
// actual changes run anything.
function showRideMenu(player) {
  // The speed slider is read against the cruise active NOW; remember which
  // one that is, because the ocean sprint can flip while the form sits on
  // screen (see the submit handler).
  const fastAtOpen = S.fast;
  const current = {
    sky: modeOn('SKYMODE'),
    sound: modeOn('SOUNDMODE'),
    hidecart: modeOn('HIDECART'),
    aggro: modeOn('AGGROMODE'),
    // The slider tunes whichever cruise speed is live -- the sky cruise while
    // sky mode is on, else the land speed. Clamped to the slider's 1..64 range
    // (a hand-set / Speed+-boosted out-of-range value must not throw on the
    // form's default).
    speed: Math.min(64, Math.max(1, activeSpeed())),
  };
  const form = new ModalFormData()
    .title('Scenic Rail Ride Settings')
    .toggle('Sky mode', { defaultValue: current.sky })
    .toggle('Cart sound', { defaultValue: current.sound })
    .toggle('Hide minecart', { defaultValue: current.hidecart })
    // Off = rider invisible: the one lever over Bedrock mob detection also
    // hides the first-person arm, so the label names both consequences.
    .toggle('Mobs aggro (mobs react to you)', { defaultValue: current.aggro })
    .slider(current.sky
      ? `Sky cruise speed, blocks/s (default ${cfg('SKYSPEED')})`
      : S.fast
        ? `Ocean cruise speed, blocks/s (default ${cfg('OCEANSPEED')})`
        : `Ride speed, blocks/s (default ${cfg('DEFAULTSPEED')})`, 1, 64, { defaultValue: current.speed, valueStep: 1 })
    .submitButton('Apply');
  form.show(player).then((r) => {
    if (r.canceled || !r.formValues) return;
    const [sky, sound, hidecart, aggro, speed] = r.formValues;
    if (current.sky !== !!sky) runCmd(`function ${NS}/mode_sky_${sky ? 'on' : 'off'}`);
    if (current.sound !== !!sound) {
      runCmd(`function ${NS}/mode_sound_${sound ? 'on' : 'off'}`);
      // Belt + suspenders: a pack update installed over the SAME manifest
      // version can leave Bedrock's function registry stale, so the new
      // mode_sound_* files silently don't exist and the score never flips.
      // If the score didn't take, write it directly (API mode only -- on
      // cmd-bridge worlds the read lies, and there the function route is
      // the working one anyway).
      if (bridgeMode === 'api' && getScore('SOUNDMODE', 0) !== (sound ? 1 : 0)) {
        setScore('SOUNDMODE', sound ? 1 : 0);
        if (!sound) runCmd('stopsound @a ir.cart_roll');
        say(sound ? '§7Minecart sound on.' : '§7Minecart sound off.');
      }
    }
    if (current.hidecart !== !!hidecart) {
      runCmd(`function ${NS}/mode_hidecart_${hidecart ? 'on' : 'off'}`);
      // Same stale-function-registry belt + suspenders as the sound toggle.
      if (bridgeMode === 'api' && getScore('HIDECART', 0) !== (hidecart ? 1 : 0)) {
        setScore('HIDECART', hidecart ? 1 : 0);
        say(hidecart ? '§7Minecart hidden - enjoy the unobstructed view.' : '§7Minecart visible again.');
      }
    }
    if (current.aggro !== !!aggro) {
      runCmd(`function ${NS}/mode_aggro_${aggro ? 'on' : 'off'}`);
      // Same stale-function-registry belt + suspenders as the sound toggle.
      if (bridgeMode === 'api' && getScore('AGGROMODE', 0) !== (aggro ? 1 : 0)) {
        setScore('AGGROMODE', aggro ? 1 : 0);
        say(aggro ? '§7Mobs aggro on.' : '§7Mobs aggro off.');
      }
    }
    const speedWant = Math.round(+speed);
    // The slider is an ABSOLUTE setter riding a delta-based state machine:
    // detect an untouched slider against the DISPLAYED value (an over-64
    // .speed shows clamped at 64), but compute the applied delta against
    // the REAL live speed -- deltaing against the clamped display made
    // "set 8 while cruising at 76" land at 20 instead of 8. (One blind
    // spot remains by construction: at over-64 speeds, sliding exactly to
    // 64 reads as untouched -- pick 63, or use the Speed - item.)
    // Delta against the REAL live cruise (sky or land) after any sky toggle
    // above -- so an untouched slider never fires, and a move applies to
    // whichever speed is now active (the shared speed_step writes .skyspd in
    // sky mode, .speed otherwise).
    if (speedWant !== current.speed) {
      if (!sky && !current.sky && S.fast !== fastAtOpen) {
        // The ocean sprint flipped while the form was open: the slider the
        // user saw (and its label) belonged to the OTHER cruise, and a
        // delta against the new one writes ocean-sized values into the land
        // speed (the classic "the ride never slowed back down over land").
        // Honor what they actually saw: set that cruise, absolutely.
        const v = Math.min(64, Math.max(1, speedWant));
        runCmd(`scoreboard players set ${P}${fastAtOpen ? 'ocnspd' : 'speed'} ir ${v}`);
        say(`§7${fastAtOpen ? 'Ocean cruise' : 'Ride'} speed: §f${v}§7 blocks/s`);
      } else {
        adjustSpeed(speedWant - activeSpeed());
      }
    }
  }).catch((e) => reportError('ride settings menu', e));
}

function showVisualMenu(player) {
  // The density dropdown shows the preset matching the live .torchdens; a
  // hand-set / config-seeded value that matches no preset displays as
  // Medium but is only overwritten if the player actively picks something
  // (change detection runs against the DISPLAYED index, so an untouched
  // submit never clobbers a custom value).
  const densIdx = TORCH_DENSITY.findIndex((d) => d.v === torchDensity());
  // Track light: same display rule as density -- a hand-set level matching
  // no preset shows as On but is only overwritten if actively picked.
  const lightIdx = LIGHT_PRESETS.findIndex((d) => d.v === lightLevel());
  const current = {
    rain: modeOn('RAINMODE'),
    // The toggle shows storms ALLOWED (on = vanilla weather); the .STORMMODE
    // score marks them SUPPRESSED (mode_storms_off sets 1) -- hence the
    // inversion here and in the handler below.
    storms: !modeOn('STORMMODE'),
    night: nightMode(),
    // Tri-state like Time: the dropdown index IS the .TORCHMODE value.
    torches: torchMode(),
    dens: densIdx >= 0 ? densIdx : 1,
    light: lightIdx >= 0 ? lightIdx : 2,
  };
  const form = new ModalFormData()
    .title('Scenic Rail Visual Settings')
    .toggle('Always Rain', { defaultValue: current.rain })
    .toggle('Allow Thunderstorms', { defaultValue: current.storms })
    .dropdown('Time', ['Default (day/night cycle)', 'Always Night', 'Always Day'], { defaultValueIndex: current.night })
    .dropdown('Torches (scattered along new track)', ['Off', 'On (day and night)', 'Auto (at night only)'], { defaultValueIndex: current.torches })
    .dropdown('Torch density', TORCH_DENSITY.map((d) => d.label), { defaultValueIndex: current.dens })
    .dropdown('Track light (above new track)', LIGHT_PRESETS.map((d) => d.label), { defaultValueIndex: current.light })
    .submitButton('Apply');
  form.show(player).then((r) => {
    if (r.canceled || !r.formValues) return;
    const [rain, storms, night, torches, dens, light] = r.formValues;
    if (current.rain !== !!rain) runCmd(`function ${NS}/mode_rain_${rain ? 'on' : 'off'}`);
    if (current.storms !== !!storms) {
      // Toggle shows storms allowed; the score marks them suppressed, so
      // "Thunderstorms ON" runs mode_storms_on which CLEARS .STORMMODE.
      runCmd(`function ${NS}/mode_storms_${storms ? 'on' : 'off'}`);
      // Stale-function-registry belt + suspenders, same as the torch/light
      // handlers below: the mode_storms_* files are NEW, so on a world whose
      // registry predates them the call silently does nothing -- write the
      // score directly if it didn't take (API mode only; on cmd-bridge
      // worlds the read lies, and there the function route works anyway).
      const stormWant = storms ? 0 : 1;
      if (bridgeMode === 'api' && getScore('STORMMODE', 0) !== stormWant) {
        setScore('STORMMODE', stormWant);
        say(storms
          ? '§7Thunderstorms ON - storms can roll in with the natural weather.'
          : '§7Thunderstorms OFF - storms will pass as plain rain.');
      }
      // Turned off during an already-raging storm: convert it right away
      // (the weatherChange watch only sees future changes).
      if (!storms) stormWatchNow();
    }
    const torchWant = torches | 0;
    if (torchWant !== current.torches) {
      runCmd(`function ${NS}/${['mode_torches_off', 'mode_torches_on', 'mode_torches_auto'][torchWant] ?? 'mode_torches_auto'}`);
      // Same stale-function-registry belt + suspenders as the Ride form's
      // toggles: mode_torches_auto is a NEW function file, so on a world
      // whose registry predates it the call silently does nothing and the
      // dropdown snaps back on the next open -- write the score directly
      // if it didn't take.
      if (bridgeMode === 'api' && getScore('TORCHMODE', 0) !== torchWant) {
        setScore('TORCHMODE', torchWant);
        say(['§7Torch mode OFF - new track stays unlit.', '§7Torch mode ON - new track will be dotted with torches, day and night.', '§7Torch mode AUTO - torches will appear beside new track at night.'][torchWant]);
      }
    }
    const nightWant = night | 0;
    if (nightWant !== current.night) {
      runCmd(`function ${NS}/${['mode_night_off', 'mode_night_on', 'mode_day_on'][nightWant] ?? 'mode_night_off'}`);
    }
    const densWant = dens | 0;
    if (densWant !== current.dens) {
      runCmd(`function ${NS}/torch_density_${TORCH_DENSITY[densWant]?.fn ?? 'medium'}`);
    }
    const lightWant = light | 0;
    if (lightWant !== current.light) {
      runCmd(`function ${NS}/mode_light_${LIGHT_PRESETS[lightWant]?.fn ?? 'on'}`);
      // Stale-function-registry belt + suspenders (the mode_light_* files
      // are NEW): if the score didn't take, write it directly (API mode
      // only -- on cmd-bridge worlds the read lies, and there the function
      // route is the working one anyway).
      const wantV = LIGHT_PRESETS[lightWant]?.v ?? 11;
      if (bridgeMode === 'api' && getScore('LIGHTMODE', -1) !== wantV) {
        setScore('LIGHTMODE', wantV);
        say(['§7Track light OFF - new track is built dark.', '§7Track light LOW - new track gets a dim glow.', '§7Track light ON - new track gets the bright line (the default).'][lightWant]);
      }
    }
  }).catch((e) => reportError('visual settings menu', e));
}

// The Tips page, opened by using the Tips item: a read-only ActionForm with
// the recommended game/video settings for the best Slow-TV experience
// (Java's twin is a plain written book with the same advice, plus its own
// Java-only video tips instead of the Bedrock ones).
function showTips(player) {
  const form = new ActionFormData()
    .title('Scenic Rail Tips')
    .body([
      '§lRecommended settings§r',
      '',
	  '§7- FOV: §f100+',
      '§7- For keyboard: Hide the HUD with §fF1',
      '§7- Simulation distance: §fLowest option',
      '§7- Render distance: §f16-24 chunks,§7',
	  'or more if your hardware keeps up',
      '§7- Max Framerate: §fmatch your monitor\'s refresh rate§7',
	  '(no benefit to going higher, just extra GPU heat)',
      '',
      '§lSettings > General§r',
      '',
      '§7- Disable §f"Enable Game Pause"§7',
	  '',
      '§7- Disable §f"Show Pause Menu on Focus Lost"',
	  '',
      '§7- Disable §f"Lower Framerate when Controller is Disconnected"§7',
      '',
      '§lConsole Tips§r',
      '',
      '§7- Hide the HUD with the §fToggle HUD§7 hotbar item - while hidden, staying on its slot also keeps your hand empty.',
	  '',
      '§7- Use a §fwired controller§7 to avoid the "controller disconnected" warning',
	  '',
      '§7- To run a custom pack on console: host it on a §fRealm§7 (a trial Realm works), then §fdownload the world as a local copy§7 to play it offline with the pack intact',
    ].join('\n'))
    .button('Close');
  form.show(player).catch((e) => reportError('tips page', e));
}

// The Toggle HUD item (slot 2 -- Bedrock-only: a Java ride is always on a
// PC, where F1 hides the HUD natively; /hud is Bedrock's command, and it's
// what console/touch riders get instead of F1). One use flips .HUDHIDDEN
// through the hud_toggle function file: hiding runs `hud @a hide all` then
// `hud @a reset item_text` -- everything gone EXCEPT the temporary
// item-name popup, so scrolling the hotbar still names the pinned items --
// and the next use runs `hud @a reset all`. /hud never touches the hand or
// what it holds -- the held-item problem is solved by the ITEM PAIR (see
// the PINNED note): while the HUD is visible the slot pins toggle_hud_shown
// (the crossed-out-eye icon), and the toggle's score flip makes the keeper
// swap in toggle_hud -- the fully transparent variant that is held as
// NOTHING -- so hiding the HUD also empties the hand of a rider parked on
// this slot, and showing it brings the icon back. One keeper write per
// toggle, correlated with the click and never with scrolling (the Tips
// still mention "Hide Hand" for hiding the bare arm as well). The
// invisible-held-item job was done by an RP attachable with empty geometry
// before, but the attachable re-instantiated on every equip (every scroll
// onto/off this slot) and that per-equip churn raced the mouse wheel and
// ATE SCROLL NOTCHES -- the same symptom the placeable Speed items once
// caused via cancelled-placement hotbar resyncs, from a different
// mechanism. Plain custom items give the client nothing to re-evaluate per
// scroll. A HUD hidden some other way (F1 is client-side; /hud can't see
// it) just costs one harmless "restore" click.
function toggleHud() {
  const before = getScore('HUDHIDDEN', 0);
  runCmd(`function ${NS}/hud_toggle`);
  // Stale-function-registry belt + suspenders (the hud_* files are NEW --
  // the same failure the settings forms guard against): if the score didn't
  // flip, run the commands directly (API mode only -- on cmd-bridge worlds
  // the read lies, and there the function route is the working one anyway).
  if (bridgeMode === 'api' && getScore('HUDHIDDEN', 0) === before) {
    if (before === 0) {
      runCmd('hud @a hide all');
      runCmd('hud @a reset item_text');
      setScore('HUDHIDDEN', 1);
      say('§7HUD hidden - use the Toggle HUD item again to bring it back.');
    } else {
      runCmd('hud @a reset all');
      setScore('HUDHIDDEN', 0);
      say('§7HUD restored.');
    }
  }
  // Mirror the new state script-side: hudHiddenNow() reads the score where
  // the API can (api bridge), and falls back to this flag on cmd-bridge
  // worlds where the read lies. The keeper's next tick swaps the slot-2
  // item variant to match (icon visible <-> held-as-nothing blank).
  S.hudHidden = bridgeMode === 'api' ? getScore('HUDHIDDEN', 0) === 1 : !S.hudHidden;
  saveState();
}

// The native debug menu, opened by using the Debug book: the .DEBUGMODE
// chat-output toggle plus the scoreboard sidebar selector. A vanilla
// sidebar shows ONE objective (max 15 rows), which is why the 30+ config
// knobs live in three groups (cfg_terrain / cfg_camera / cfg_ride) and this
// menu switches between them and the Live state view (the dbg mirror,
// refreshed per tick while selected -- tickStateSidebar). Everything is
// applied by running the same function files as Java's Debug book.
const SIDEBAR_FN = ['sidebar_off', 'sidebar_terrain', 'sidebar_camera', 'sidebar_ride', 'sidebar_state', 'sidebar_diag'];
function showDebugMenu(player) {
  const current = {
    chat: debugOn(),
    sidebar: Math.min(5, Math.max(0, getScore('SIDEBAR', 0))),
  };
  const form = new ModalFormData()
    .title('Scenic Rail Mode Debug')
    .toggle('Debug chat output (speed system, chunk status)', { defaultValue: current.chat })
    .dropdown('Scoreboard sidebar', [
      'Hidden',
      'Terrain settings (cfg_terrain)',
      'Camera settings (cfg_camera)',
      'Ride settings (cfg_ride)',
      'Live ride state',
      'Live rig & tick diagnostics',
    ], { defaultValueIndex: current.sidebar })
    .toggle('Print scoreboard command examples to chat', { defaultValue: false })
    .submitButton('Apply');
  form.show(player).then((r) => {
    if (r.canceled || !r.formValues) return;
    const [chat, sidebar, help] = r.formValues;
    if (!!chat !== current.chat) runCmd(`function ${NS}/${chat ? 'debug' : 'debug_off'}`);
    if ((sidebar | 0) !== current.sidebar) runCmd(`function ${NS}/${SIDEBAR_FN[sidebar | 0] ?? 'sidebar_off'}`);
    if (help) runCmd(`function ${NS}/cmd_help`);
  }).catch((e) => reportError('debug menu', e));
}

// The "Live state" sidebar's per-tick refresh (while .SIDEBAR is 4): the
// ten shared-brain scores go through the shared debug_state (the same file
// Java's debug_tick runs), and the five script-native values are written
// beside them -- 15 rows total, the sidebar maximum, same names as Java.
function tickStateSidebar() {
  if (getScore('SIDEBAR', 0) !== 4) return;
  runCmd(`function ${NS}/debug_state`);
  try {
    setScore('headX', S.headX, 'dbg');
    setScore('gap', S.headX - Math.floor(S.paceX), 'dbg');
    setScore('avg', S.avg, 'dbg');
    setScore('fast', S.fast ? 1 : 0, 'dbg');
    setScore('started', S.started ? 1 : 0, 'dbg');
  } catch { /* dbg objective unavailable (split scoreboards) */ }
}

// The "Live rig & tick diagnostics" sidebar (.SIDEBAR 5, Bedrock-only --
// these are Script API measurements Java has no equivalent for), refreshed
// every tick while selected. The lurch hunt's real-time counterpart to the
// debug roll line: is the rig where it should be, is the engine delivering
// ticks on time, and is the builder starved -- watched live, per tick.
// Rows (the sidebar sorts by value, the names identify each; ALL of this is
// skipped while the view is off -- the gate is one score read per tick):
//   drift   seat's distance from its glide target, in 1/100 blocks (the
//           drift-catch input -- glide() teleports at 400)
//   astray  rider's distance from the seat, in 1/100 blocks (the re-mount
//           input -- the keeper re-mounts after ASTRAY_TICKS ticks over 250)
//   astrayN consecutive too-far ticks so far (re-mount fires at 4)
//   pvelX/Y the PLAYER's own getVelocity(), in 1/100 blocks/tick -- what the
//           engine is actually doing to the rider, pack-driven or not
//   svelX/Y the seat's getVelocity(), same scale (the pack's commanded
//           motion; compare against pvel to see who is moving whom)
//   spd/tgt/cap  pace speed: current / target / the buffer's soft ceiling,
//           all in 1/10 blocks per second (cap below tgt = the buffer is
//           what's limiting the ride)
//   gap     head - pace, blocks (.PACE_CART_BEHIND = full buffer)
//   riderBk head - rider, blocks (how far behind the build head you are)
//   lull    wall-clock ms between the last two engine ticks (>>50 with a
//           small tick = the ENGINE is stuttering, not this pack)
//   tick    the script's own last tick() cost in ms
//   starve  consecutive ticks the builder wanted to build but the chunk
//           ahead wasn't loaded
let diagActive = false; // refreshed once per tick in tick()
const diag = { drift: -1, astray: -1, astrayN: 0 };
function tickDiagSidebar() {
  if (!diagActive) return;
  try {
    setScore('drift', diag.drift, 'dbg_live');
    setScore('astray', diag.astray, 'dbg_live');
    setScore('astrayN', diag.astrayN, 'dbg_live');
    setScore('starve', starveRun, 'dbg_live');
    setScore('gap', S.headX - Math.floor(S.paceX), 'dbg_live');
    setScore('spd', Math.round(S.paceSpeed * 200), 'dbg_live');
    setScore('tgt', Math.round(S.targetSpeed * 200), 'dbg_live');
    const cap = Math.max(0, ((S.headX - camAhead() - 8 - S.paceX) / 40) * 20);
    setScore('cap', Math.round(cap * 10), 'dbg_live');
    setScore('lull', dbgLastLull, 'dbg_live');
    setScore('tick', dbgLastCost, 'dbg_live');
    const rider = findRider();
    if (rider) {
      try {
        setScore('riderBk', Math.round(S.headX - rider.location.x), 'dbg_live');
        const v = rider.getVelocity();
        setScore('pvelX', Math.round(v.x * 100), 'dbg_live');
        setScore('pvelY', Math.round(v.y * 100), 'dbg_live');
      } catch { /* rider unloaded this tick: rows keep their last value */ }
    }
    try {
      const seat = S.seatId ? world.getEntity(S.seatId) : undefined;
      if (seat?.isValid) {
        const sv = seat.getVelocity();
        setScore('svelX', Math.round(sv.x * 100), 'dbg_live');
        setScore('svelY', Math.round(sv.y * 100), 'dbg_live');
      }
    } catch { /* seat unloaded: rows keep their last value */ }
  } catch { /* dbg_live objective unavailable (split scoreboards) */ }
}

// The ride's rider: normally the one player the ride belongs to, matched by
// NAME (the most stable identity across rejoins). But begin() accepts ANY
// entity -- parity with Java, where `execute as <some armor stand> run
// function infinite_rail:begin` starts a full headless ride (that's how both
// editions' test suites ride) -- and a non-player rider is matched by entity
// id instead (undefined while its chunk is unloaded, exactly like an offline
// player, so the same freeze rule covers both).
// Memoized per tick: the tick driver, keepers, camMove, tickSound and the
// diag sidebar each ask for the rider -- one player-list scan a tick is
// plenty. Keyed on the identity too, so a begin()/stop() between ticks
// (scriptevent handlers run outside the tick loop) can never serve a stale
// rider; a handle that went invalid mid-tick re-resolves on the spot.
let riderMemoAt = -1;
let riderMemoKey = '';
let riderMemo;
function findRider() {
  const key = `${S.riderName}|${S.riderId}`;
  if (riderMemoAt === tickN && riderMemoKey === key) {
    if (riderMemo === undefined) return undefined;
    try { if (riderMemo.isValid) return riderMemo; } catch { /* re-resolve */ }
  }
  let r;
  if (S.riderName) {
    r = world.getAllPlayers().find((p) => p.name === S.riderName);
  } else if (S.riderId) {
    try {
      const e = world.getEntity(S.riderId);
      r = e?.isValid ? e : undefined;
    } catch { r = undefined; }
  }
  riderMemoAt = tickN;
  riderMemoKey = key;
  riderMemo = r;
  return r;
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

// Fast path for the per-tick rig lookups: a direct get-by-id (plus a tag
// check, so a stale id can never impersonate a rig piece) instead of the
// full tag-filtered world entity scan. The findTagged scan still runs on
// any fast-path miss AND at least once a second per piece -- it is also the
// duplicate sweeper, and duplicates only ever appear in rejoin races, so a
// stray copy lingers at most ~1 s instead of one tick. Net: two world
// entity scans per tick become two id lookups, ~19 ticks out of 20.
const RIG_SCAN_EVERY = 20;
let cartScanAt = -1e9;
let seatScanAt = -1e9;
function fastTagged(id, tag) {
  if (!id) return undefined;
  try {
    const e = world.getEntity(id);
    return e?.isValid && e.hasTag(tag) ? e : undefined;
  } catch { return undefined; }
}

function findCart() {
  if (tickN - cartScanAt < RIG_SCAN_EVERY) {
    const fast = fastTagged(S.cartId, TAG_RIDE);
    if (fast) return fast;
  }
  cartScanAt = tickN;
  const cart = findTagged(null, TAG_RIDE, S.cartId, CART_TYPE);
  if (cart) S.cartId = cart.id;
  return cart;
}

function findSeat() {
  if (tickN - seatScanAt < RIG_SCAN_EVERY) {
    const fast = fastTagged(S.seatId, TAG_SEAT);
    if (fast) return fast;
  }
  seatScanAt = tickN;
  const seat = findTagged(SEAT_TYPE, TAG_SEAT, S.seatId);
  if (seat) S.seatId = seat.id;
  return seat;
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
  const t0 = Date.now();
  const histStart = Math.max(0, S.trackY.length - HIST_PERSIST);
  world.setDynamicProperty('ir:state', JSON.stringify({
    started: S.started, autodone: S.autodone,
    headX: S.headX, railY: S.railY, centerZ: S.centerZ, avg: S.avg,
    nextLoad: S.nextLoad, trackBase: S.trackBase + histStart,
    trackY: S.trackY.slice(histStart),
    paceX: S.paceX, paceSpeed: S.paceSpeed, targetSpeed: S.targetSpeed,
    fast: S.fast, oceanRun: S.oceanRun, landRun: S.landRun,
    lastChunk: S.lastChunk, s2: S.s2, riderName: S.riderName, riderId: S.riderId,
    hudHidden: S.hudHidden, weather: S.weather,
  }));
  // The debug roll line reports the window's worst write (this is the
  // pack's one recurring world-database write -- if engine save pressure is
  // what stutters a long ride, it can show up here first).
  const dt = Date.now() - t0;
  if (dt > dbgSaveMax) dbgSaveMax = dt;
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
    S.riderId = typeof d.riderId === 'string' ? d.riderId : '';
    S.hudHidden = !!d.hudHidden;
    S.weather = typeof d.weather === 'string' ? d.weather : '';
    syncFast(); // the shared speed_step reads .fast from the scoreboard
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
//   3. a walk DOWN past anything Java's probe also ignores: leaves and
//      collision-less foliage (like motion_blocking_no_leaves), plus the
//      not-terrain list (isNotTerrain -- tree trunks, giant mushrooms and
//      man-made structure blocks like village houses; Java digs through the
//      same set via #infinite_rail:not_terrain), so trees and buildings
//      never read as terrain height. Water is not in the list: a liquid
//      surface still counts as terrain.
// Returns the Y one above the (possibly liquid) surface -- the same convention
// as the Java heightmap -- or undefined for void/unloaded reads.

// One ride samples every X twelve times (the 12-sample window slides one block
// per column), and the ocean climb makes a deep-water sample cost tens of
// block reads -- so completed reads are memoized per column until the head
// passes them (pruned in rollChunks, reset by begin).
const surfMemo = new Map();

function surfaceY(x, z) {
  // At the edge of the ticking set (the corridor's border ring)
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
    } else if (id.includes('leaves') || block.isSolid === false || isNotTerrain(id)) {
      // Skip what Java's probe skips: leaves, blocks the engine reports as
      // explicitly NON-solid (foliage, snow layers), and everything the
      // not-terrain list names -- tree trunks, giant mushrooms, and man-made
      // structure blocks (village roofs, planks, glass, wool...), so trees
      // and buildings never read as ground; non-solid covers the air pockets
      // under them (house interiors), so the walk reaches the real floor.
      // The isSolid/isLiquid comparisons are deliberately against literal
      // true/false: if they are unavailable on this module version they read
      // undefined, and the block is ACCEPTED as surface -- a flower
      // miscounted as ground costs a block of noise (well inside .MIN_CHANGE),
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

// sample_window.mcfunction: one surface sample every .SAMPLE_BLOCK_INTERVAL
// blocks out to .SAMPLE_WINDOW east of the head (12 samples at +4..+48 with
// the defaults), each clamped to at most .DOWNCLAMP below the previous
// average (no upward clamp -- approaching mountains register at their full
// height), summed and floor-divided by the derived sample count (Java's
// .winn). Both knobs are floored at 1 so a zero can neither loop in place
// nor divide by zero.
function sampleWindow() {
  const step = Math.max(1, cfg('SAMPLE_BLOCK_INTERVAL'));
  const count = Math.max(1, Math.floor(cfg('SAMPLE_WINDOW') / step));
  const lo = S.avg - cfg('DOWNCLAMP');
  let sum = 0;
  let bad = 0;
  for (let i = 1; i <= count; i++) {
    let s = surfaceY(S.headX + i * step, S.centerZ);
    if (s === undefined || s <= -63) { s = S.avg; bad += 1; } // void: discard
    if (s < lo) s = lo;
    sum += s;
  }
  S.avg = Math.floor(sum / count);
  S.lastBad = bad; // surfaced in the debug roll line: all-bad = probe is broken
}

// The near-ground scan feeding the shared brain's slope-timing guards
// (decide's .dig/.dig2/.push/.due and consider_start's start rules --
// CONTEXT.md section 7j): probed every 2 blocks at odd offsets +1, +3, +5,
// ... exactly like Java's near_scan/near_step. The probe itself digs
// through the not-terrain list (trees, structures -- isNotTerrain), and
// consecutive probes fold into PAIRS -- min(this, prev) -- to erase what
// the dig-down can't: a 1-2 block spike of REAL terrain (rock fins) only
// catches one probe of a pair, so the min drops it, while real ground
// (4+ wide) spans both probes and registers.
// Three scores result: .gfloor (highest pair within .DOWNLOOK_AHEAD -- the
// descent guard), .gmax (highest pair anywhere in the walk -- the climb
// contact trigger; the climb side has no reach knob, it always scans the
// full .SAMPLE_WINDOW, the line's whole planning horizon) and .gcone (the
// climb schedule: over pairs actually in the way, above railY - HOVER, the
// highest 45-degree projection pair - distance).
// Sentinels: -10000 for .gfloor/.gmax (their guards fail open without
// data) and for a .gcone with nothing to climb for (the schedule gate
// holds); +32000 for .gcone when the scan got no valid probes at all
// (reverts to plain average-driven behavior). The walk's reach IS the
// sample window, so the reads hit the per-column surface memo the window
// already fills and the scan costs no extra real probes.
function nearScan() {
  const down = cfg('DOWNLOOK_AHEAD');
  const w = Math.max(1, cfg('SAMPLE_WINDOW'));
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
      if (gmax === null || pmin > gmax) gmax = pmin;
      if (pmin > gbase && (gcone === null || pmin - nd > gcone)) gcone = pmin - nd;
    }
    prev = s;
  }
  brainSet('gfloor', gfloor ?? -10000);
  brainSet('gmax', gmax ?? -10000);
  brainSet('gcone', gcone ?? (valid === 0 ? 32000 : -10000));
}

// The descent-shift scan (CONTEXT.md section 7l; Java's shift_scan/
// shift_step): the "logical second pass" that lets a gap-blocked DESCENT
// jump the spacing gap. Before anything is built, verify the whole plan
// over the terrain ahead: (1) the entire shifted 45-degree descent path
// stays clear of ground -- beyond the .PLOW_GRACE_DOWN levels the swoop
// may cut through -- so the floor guard cannot cut it into pieces and the
// shifted descent is the SAME single event to the SAME landing -- and
// (2) the landing really is a BOTTOM: ground sitting at the landing level
// (within .MIN_CHANGE under the hover line) for .SHIFT_REQ_BOTTOM
// columns, so the calm the gap exists to guarantee simply happens at the
// bottom. Ground still falling away past the landing fails (a gentle
// downhill face keeps its gap-paced swoops). Probes at odd offsets,
// paired mins (the near scan's spike eraser), out to descent +
// .SHIFT_REQ_BOTTOM capped at 96; the surface memo makes the walk nearly
// free. Output: .sver, the verified horizon in blocks, written EVERY
// column (0 = not verified / not applicable / off); consider_start jumps
// the gap when it covers descent + bottom.
function shiftScan(target) {
  const stretch = cfg('SHIFT_REQ_BOTTOM');
  const D = S.railY - target;
  const H = D + stretch;
  let sver = 0;
  if (stretch >= 1 && D >= cfg('MIN_CHANGE') && H <= 96) {
    const grace = cfg('PLOW_GRACE_DOWN');
    const band = S.railY - D - cfg('HOVER') - cfg('MIN_CHANGE');
    let prev = null;
    for (let off = 1; off <= H + 1; off += 2) {
      const s = surfaceY(S.headX + off, S.centerZ);
      if (s === undefined || s <= -63) break;
      if (prev !== null) {
        const pmin = Math.min(prev, s);
        if (pmin > S.railY - Math.min(off, D) + grace) break;
        if (off > D && pmin < band) break;
        sver = off;
      }
      prev = s;
    }
  }
  brainSet('sver', sver);
}

// --- Column placement ----------------------------------------------------------
// place_flat / place_up / place_down + carve + support, in native block API
// calls. Same order as Java: carve the bore first, then the support (the rail
// needs it to exist), then the rail, then the light.
//
// The support is a plain smooth_stone block -- the honest version of the
// stone pier Java fakes with a display-entity disguise over its redstone
// block. Bedrock's track carries no power at all (see the palette note at
// RAIL_FLAT).

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

// --- Surface restoration --------------------------------------------------
// The bore's SIDE stacks are the only place a carve can leave ugly exposed
// dirt (the center's floor is always the support block). Before a side
// stack is cleared, noteSurface remembers what its original surface was:
// the topmost block below the bottommost air cell of the span about to be
// carved (the walk stops at the FIRST air, so an overhead canopy never
// hides the true ground), classified into a small class -- grass, podzol,
// mycelium, moss, snow. A span with no air at all (a full tunnel face)
// classifies its TOP cell instead: a tunnel grazing just under a meadow
// still counts as grass, deep rock classifies 0 = leave alone. After the
// clear, fixSurface walks down to the newly exposed top block and paints
// it back: exposed DIRT becomes the remembered material, and snow cover
// additionally lays a fresh snow layer on whatever the new top is.
// The Java twin is surf_note/surf_class/surf_fix -- keep the class lists
// in step. NOTE the inverted snow ids: Bedrock's snow_layer/snow are
// Java's snow/snow_block.
const SURFACE_CLASSES = {
  'minecraft:grass_block': 1,
  'minecraft:podzol': 2,
  'minecraft:mycelium': 3,
  'minecraft:moss_block': 4,
  'minecraft:snow_layer': 5, // the thin layer (Java: minecraft:snow)
  'minecraft:snow': 5,       // the full block (Java: minecraft:snow_block)
};
// What fixSurface paints exposed dirt into, by class (class 5's snowy
// ground turns to grass like the grass a snow layer usually sits on).
const SURFACE_PAINT = ['', 'minecraft:grass_block', 'minecraft:podzol',
  'minecraft:mycelium', 'minecraft:moss_block', 'minecraft:grass_block'];

function noteSurface(x, z, yBase, h) {
  try {
    let airAt = -1;
    for (let dy = 0; dy <= h; dy++) {
      const b = dim.getBlock({ x, y: yBase + dy, z });
      if (!b) return 0;                     // border chunk: skip quietly
      if (b.isAir === true) { airAt = dy; break; }
    }
    // Air at the very bottom: the ground below the span is already exposed
    // today -- clearing uncovers nothing new here.
    if (airAt === 0) return 0;
    // First air above the bottom: the surface is just below it. No air at
    // all: the span's top cell stands in.
    let sy = airAt > 0 ? yBase + airAt - 1 : yBase + h;
    // A plant standing on the surface isn't the surface: step down through
    // up to 3 kept-vegetation cells before giving up.
    for (let skip = 0; skip <= 3; skip++) {
      const b = dim.getBlock({ x, y: sy - skip, z });
      if (!b) return 0;
      const id = b.typeId ?? '';
      const cls = SURFACE_CLASSES[id];
      if (cls) return cls;
      if (!isVegetation(id)) return 0;
    }
    return 0;
  } catch { return 0; }
}

function fixSurface(x, z, yBase, cls) {
  if (!cls) return;
  try {
    // Walk down past air and spared plants to the newly exposed top block.
    // Bounded to 8 below the rail: deeper means the clear exposed nothing
    // here (the stack hung over a hole -- the ground down there was never
    // covered).
    for (let dy = 0; dy >= -8; dy--) {
      const b = dim.getBlock({ x, y: yBase + dy, z });
      if (!b) return;
      const id = b.typeId ?? '';
      if (b.isAir === true || isVegetation(id)) continue;
      if (id === 'minecraft:dirt') dim.setBlockType({ x, y: yBase + dy, z }, SURFACE_PAINT[cls]);
      if (cls === 5) {
        const above = dim.getBlock({ x, y: yBase + dy + 1, z });
        if (above && above.isAir === true) dim.setBlockType({ x, y: yBase + dy + 1, z }, 'minecraft:snow_layer');
      }
      return;
    }
  } catch { /* border chunk: cosmetic only, skip */ }
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
  const carveH = dir === 0 ? cfg('TUNNELCLEAR') : cfg('TUNNELCLEAR') + 1; // .TUNNELUP
  // Surface restoration, step 1: remember what each side stack's original
  // surface was, before anything is cleared (see noteSurface above).
  const surfL = noteSurface(x, z - 1, y, carveH);
  const surfR = noteSurface(x, z + 1, y, carveH);
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
  // Surface restoration, step 2: the clear is done -- paint each side
  // stack's newly exposed ground back into its remembered surface material.
  fixSurface(x, z - 1, y, surfL);
  fixSurface(x, z + 1, y, surfR);
  dim.setBlockPermutation({ x, y: y - 1, z }, SUPPORT);
  dim.setBlockPermutation({ x, y, z }, dir === 0 ? RAIL_FLAT : dir === 1 ? RAIL_UP : RAIL_DOWN);
  // The track light, at the Track light mode's level (0 = none -- the carve
  // above already left the cell clear, so "off" just places nothing).
  const lvl = lightLevel();
  if (lvl > 0) dim.setBlockType({ x, y: y + 3, z }, LIGHT_BLOCK_PREFIX + lvl);
}

// Torch mode (.TORCHMODE, tri-state -- mode_torches_on/auto/off; the
// caller's torchLit() gate decides whether torches are being planted right
// now): sprinkle torches on the terrain around the line as it is built.
// The native twin of Java's place_torch/torch_at/torch_try: same odds knob
// (.TORCHODDS percent of columns), same 2..TORCHRANGE side offsets, same
// placement policy. Where the
// ground below is WATER a torch can't stand, so instead a sea pickle is
// planted on the bed (config .SEAPICKLE 1..4 = pickles = brightness; 0 = skip
// like before) -- see the water branch below. Other hopeless spots are still
// skipped (lava or non-solid ground). Everything else gets its torch attempt,
// so frozen and snowy biomes are lit too: ice (all kinds) holds a torch
// fine, and a snow LAYER occupying the target cell is REPLACED by the torch
// (what placing one by hand on snowy ground does; requiring an air cell
// left whole snowfields torchless). The 48 cap matches Java's (its widened
// forceload corridor's ceiling) -- and the ticking-area corridor widens to
// the same clamped .TORCHRANGE while torch mode is on (corridorOptions).
function maybeTorch(x) {
  if (Math.random() * 100 >= torchDensity()) return;
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
    // Water case: a torch can't stand on water, so torch mode plants a sea
    // pickle on the bed instead (config .SEAPICKLE 1..4 = pickles = brightness;
    // 0 = skip like before, no GUI option). Only water -- lava still skips.
    const bid = below.typeId ?? '';
    if (bid === 'minecraft:water' || bid === 'minecraft:flowing_water') {
      let n = cfg('SEAPICKLE');
      if (n < 1 || !SEA_PICKLE) return;
      if (n > 4) n = 4;
      // Walk down through the water column to the true bed -- the same
      // "skip what isn't real terrain" idea probeSurface uses for the surface
      // scan, but skipping water and submerged flora (kelp, seagrass) instead
      // of leaves. (getTopmostBlock already ignores liquid, but the walk is
      // robust against plants sitting on the floor.)
      let fy = surf - 1;               // start in the water (surf is one above the top)
      let floorY;
      for (let step = 0; step < 384; step++) {
        const b = dim.getBlock({ x, y: fy, z });
        if (!b) return;               // unloaded: give up on this pickle
        const fid = b.typeId ?? '';
        const liquid = fid === 'minecraft:water' || fid === 'minecraft:flowing_water' || b.isLiquid === true;
        if (liquid || fid.includes('leaves') || b.isSolid === false || isNotTerrain(fid)) { fy -= 1; continue; }
        floorY = b.y;                 // first solid, non-flora block = the bed
        break;
      }
      if (floorY === undefined) return;
      try { dim.setBlockPermutation({ x, y: floorY + 1, z }, SEA_PICKLE[n]); }
      catch { /* border chunk: skip this pickle */ }
      return;
    }
    if (below.isLiquid === true || below.isSolid === false) return;
    if (bid.includes('leaves')) return; // canopy top the probe couldn't dig past
    const cid = cell.typeId ?? '';
    if (!(cell.isAir === true || cid === 'minecraft:air' || cid === 'minecraft:snow_layer')) return;
    dim.setBlockPermutation({ x, y: surf, z }, TORCH);
  } catch { /* border chunk: skip this torch */ }
}

// A slope just started (the shared start_event raised .retro): retroactively
// clear the center bore over the last .SLOPECLEAR columns -- the camera
// lifts off the rail line before the slope arrives, so vegetation spared
// over those (flat, same-elevation) columns must go after all. Vertical
// only: the cells left and right of the track keep their plants. Only
// VEGETATION is removed -- the one other thing in an already-carved bore is
// the pack's own track light at rail+3, which a blanket air-fill used to
// DELETE (every slope start left the .SLOPECLEAR columns behind it dark).
// Java's retro_fill is the same clear via `fill ... replace
// #infinite_rail:keep`, clamped the same way.
function retroClear(headX) {
  const k = Math.min(cfg('SLOPECLEAR'), headX - S.trackBase);
  const h = cfg('TUNNELCLEAR');
  if (k < 0 || h < 2) return;
  for (let x = headX - k; x <= headX; x++) {
    for (let y = S.railY + 2; y <= S.railY + h; y++) {
      try {
        const b = dim.getBlock({ x, y, z: S.centerZ });
        if (b && isVegetation(b.typeId ?? '')) dim.setBlockType({ x, y, z: S.centerZ }, 'minecraft:air');
      } catch { /* border chunk: the next slope's clear catches it */ }
    }
  }
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
  shiftScan(target);
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
  // (advance.mcfunction's step 5b on Java). torchLit() is the tri-state
  // gate: always in mode 1, night-only in the default auto mode 2 (the
  // shared torch_auto decides), never in mode 0.
  if (torchLit()) maybeTorch(colX);

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

// Debug-line pipeline-health window, reset on every roll line so each line
// describes exactly the 16 blocks since the previous one (the lurch hunt:
// long-session rides degrade in ways the frontier number alone can't
// separate). The tick pacing pair is the engine-stutter discriminator: the
// script's own cost (tick) can be small while the ENGINE delivers ticks
// late (lull) -- a big lull with a healthy frontier and full buffer means
// the stutter is engine-side (world save/compaction, memory pressure), not
// this pack's work.
let dbgWin0 = Date.now();  // window start
let dbgWinTicks = 0;       // engine ticks seen in the window
let dbgTickCostSum = 0;    // total ms spent inside tick()
let dbgTickCostMax = 0;    // worst single tick() ms
let dbgLullMax = 0;        // longest wall-clock gap BETWEEN consecutive ticks
let dbgPrevTickAt = 0;     // Date.now() at the previous tick's start
let dbgSaveMax = 0;        // worst saveState() write ms
let dbgStarveTicks = 0;    // ticks the builder wanted to build but the chunk ahead wasn't loaded
// The live-diagnostics sidebar's per-tick copies (not windowed like the
// roll-line stats above -- the sidebar shows the CURRENT tick's numbers).
let dbgLastLull = 0;       // wall-clock ms between the last two ticks
let dbgLastCost = 0;       // the last tick()'s own cost in ms
let starveRun = 0;         // CONSECUTIVE starved ticks right now (0 = building fine or buffer full)

// The per-tick build budget, auto-scaled to the ride's speed (Java's
// build_budget.mcfunction twin): the builder may lay .BUILD_FACTOR x the
// track the ride is consuming -- ceil(consumption in blocks/tick x factor)
// columns, floored at 1. Consumption is the larger of the pace's CURRENT
// speed and its TARGET: the target keeps recovery honest while the pace is
// eased off by the low-buffer soft ceiling (recovering at factor x the
// eased speed would never rebuild the buffer that lifts the easing), the
// current speed covers the ramp overshoot cases. A fixed cap (the old
// .BUILD_PER_TICK 15) made every catch-up burst cost worst-case work at
// any speed -- exactly when the engine was already struggling.
function buildBudget() {
  const factor = Math.max(1, cfg('BUILD_FACTOR'));
  const consume = Math.max(S.paceSpeed, S.targetSpeed); // blocks/tick
  return Math.max(1, Math.ceil(consume * factor));
}

function buildLoop() {
  let budget = buildBudget();
  const ahead = cfg('PACE_CART_BEHIND');
  let built = false;
  while (budget > 0 && S.headX - Math.floor(S.paceX) < ahead) {
    if (!buildReady()) {
      dbgStarveTicks += 1;
      starveRun += 1;
      // A FULLY starved builder stops advancing the head, so the roll line
      // (printed per 16 blocks of head travel) goes silent exactly when
      // things are worst -- keep a time-based heartbeat in debug mode.
      if (stallTicks > 0 && stallTicks % 100 === 0) {
        dbg(`builder starved ${(stallTicks / 20).toFixed(0)}s at x=${S.headX} (chunk ahead not loaded)`);
      }
      break;
    }
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
  // The live-diag starve streak ends when anything built OR the buffer is
  // simply full (an idle builder at full gap isn't starving).
  if (built || S.headX - Math.floor(S.paceX) >= ahead) starveRun = 0;
  // If the builder is starved for terrain while the track buffer is running
  // low, say so once. The corridor generates terrain server-side, so this
  // now only fires when generation itself can't keep up with the ride (or
  // the corridor failed -- the debug roll line's tam counters show which).
  if (!built && S.headX - Math.floor(S.paceX) < ahead - 64) {
    stallTicks += 1;
    if (stallTicks === 200 && !stallWarned) {
      stallWarned = true;
      say('§eTerrain ahead is generating slowly; the ride will ease off until it catches up. Run §b/function infinite_rail/debug§e for chunk-loading status.');
    }
  } else {
    stallTicks = 0;
  }
}

// --- Chunk management ----------------------------------------------------------
// roll_chunks/forceload: keep terrain open ahead of the head and roll the
// world spawn + respawn points forward with the ride.
//
// The corridor is the Bedrock twin of Java's forceload macro, on
// world.tickingAreaManager (@minecraft/server 2.6.0): a narrow ticking area
// from just behind the rig out past the build head, re-anchored every 16
// blocks of head travel (the same cadence as Java's roll). Manager areas
// both LOAD and GENERATE their chunks server-side with a player online --
// measured with a real client: a 49-chunk area over never-generated terrain
// resolved fully ticking in ~1 s -- which is what command /tickingarea
// could never do (measured: zero contributed chunks while a player is
// online; that limitation is why the retired chunk-scout entity existed,
// and why terrain generation used to be capped by the RIDER'S render
// distance -- it no longer is).
//
// Each roll claims the NEW span first and releases the old one only after
// the create resolves (the A/B name pair), so the overlap never unloads.
// The corridor is deliberately narrow -- ±1 chunk normally, the clamped
// .TORCHRANGE while torch mode may throw torches wider (clock-blind, like
// Java's forceload_here) -- so the pack's ticking/generation footprint is a
// ~3-chunk-wide band instead of the scout bubble's 13x13 disc: less mob
// simulation, less disk, less save-write churn.

let corrLive = null;       // the currently-live corridor's area name (null = none)
let corrFromX = null;      // the live corridor's western edge (the cull's bookmark)
let corrBusy = false;      // a createTickingArea is still in flight
let corrLoadedAt = 0;      // tickN when the last create resolved (debug)
function tamgr() {
  try { return world.tickingAreaManager; } catch { return undefined; }
}

function corridorOptions() {
  // Width: the MINIMUM that covers what the builder touches. The centerline
  // is anchored at Z ≡ 14 (mod 16) by begin(), so ±1 block (the rail strip
  // z-1..z+1, offsets 13..15) stays inside a single chunk row -- the whole
  // non-torch corridor is one row of chunks. While torch mode is on or auto
  // the width grows to the clamped .TORCHRANGE (default 30: with the
  // anchored centerline the band [z-30, z+30] spans exactly four rows).
  let w = 1;
  if (torchMode() >= 1) w = Math.min(48, Math.max(2, cfg('TORCHRANGE')));
  const rigX = Math.floor(S.paceX + camAhead());
  const fromX = rigX - CORR_BEHIND;
  // Ahead: Java's .TERRAIN_GENAHEAD semantics (generate well past the
  // head), floored at what the builder actually needs (the sample window +
  // margin) and trimmed to the per-area chunk budget at extreme widths.
  const colsZ = Math.floor((S.centerZ + w) / 16) - Math.floor((S.centerZ - w) / 16) + 1;
  const maxColsX = Math.max(6, Math.floor(CORR_BUDGET / colsZ));
  const ahead = Math.max(cfg('SAMPLE_WINDOW') + 24, Math.min(cfg('TERRAIN_GENAHEAD'), 512));
  const toX = Math.min(Math.max(S.headX, rigX) + ahead, fromX + maxColsX * 16 - 1);
  return {
    dimension: dim,
    from: { x: fromX, y: 0, z: S.centerZ - w },
    to: { x: toX, y: 0, z: S.centerZ + w },
  };
}

// Re-anchor the corridor on the ride's current span. Fire-and-forget async:
// the create resolves when every chunk is loaded AND TICKING (generation
// included), which can take a second or two over fresh terrain -- rolls
// that arrive while one is in flight are simply skipped (the in-flight span
// already reaches .TERRAIN_GENAHEAD past the head, so the corridor
// tolerates lagging a roll or two at extreme speeds).
async function rollCorridor() {
  const mgr = tamgr();
  if (!mgr || corrBusy || !dim) return;
  corrBusy = true;
  const next = corrLive === CORR_A ? CORR_B : CORR_A;
  try {
    const opts = corridorOptions();
    if (!mgr.hasCapacity(opts) && corrLive) {
      // Not enough budget for the overlap (extreme torch widths): release
      // the old corridor first and accept the one-roll reload seam.
      try { mgr.removeTickingArea(corrLive); } catch { /* already gone */ }
      corrLive = null;
    }
    await mgr.createTickingArea(next, opts);
    corrLoadedAt = tickN;
    // Cull the slab this roll releases, while the OLD area still holds it
    // loaded -- its last loaded moment (see cullPassedEntities).
    if (corrFromX !== null && opts.from.x > corrFromX) {
      cullPassedEntities(Math.max(corrFromX, opts.from.x - 128), opts.from.x, opts.from.z - 16, opts.to.z + 16);
    }
    if (corrLive && corrLive !== next) {
      try { mgr.removeTickingArea(corrLive); } catch { /* already gone */ }
    }
    corrLive = next;
    corrFromX = opts.from.x;
  } catch (e) {
    // Keep whatever corridor is live; the next roll retries. A half-created
    // area under the new name would block that retry -- clear it.
    try { mgr.removeTickingArea(next); } catch { /* never created */ }
    if (tickN - lastBuildErrAt > 100) {
      lastBuildErrAt = tickN;
      dbg(`corridor update failed: ${e}`);
    }
  } finally {
    corrBusy = false;
  }
}

// Remove every ticking area this pack owns (the manager cannot even see
// other packs' or command areas). begin/stop/init cleanup.
function clearCorridor() {
  try { tamgr()?.removeAllTickingAreas(); } catch { /* manager unavailable */ }
  corrLive = null;
  corrFromX = null;
}

// The passed-entity cull -- the safe salvage of the retired trail wiper
// (whose block-filling half both froze Java and crashed BDS): entities
// only, no block work. Runs once per corridor roll over the slab of chunks
// the roll releases, at its last loaded moment, so passed mobs, drops and
// stands are neither saved into the unloaded chunks nor left for a revisit
// to reload -- and mobs that chased the ride stop accumulating behind it.
// Bedrock's own despawn rules already reap most hostiles this close to the
// rider; this catches the persistent rest (villagers, golems, named
// things, dropped items). Players are the only exclusion needed: every
// ride entity (seat, cart, the surrogate rider on the seat) glides at
// rigX = the corridor tail + CORR_BEHIND, a full slab ahead of anything
// culled here, by construction. EntityQueryOptions has no box, so the
// query is a covering sphere filtered down to the slab.
function cullPassedEntities(x0, x1, z0, z1) {
  if (x1 <= x0) return;
  try {
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const r = Math.sqrt(((x1 - x0) / 2 + 1) ** 2 + ((z1 - z0) / 2 + 1) ** 2 + 232 ** 2);
    for (const e of dim.getEntities({ location: { x: cx, y: 100, z: cz }, maxDistance: r })) {
      try {
        if (e.typeId === 'minecraft:player') continue;
        const p = e.location;
        if (p.x >= x0 && p.x < x1 && p.z >= z0 && p.z <= z1) e.remove();
      } catch { /* stale handle */ }
    }
  } catch { /* query raced an unload: the slab unloads regardless */ }
}


function rollChunks() {
  const x = S.headX, y = S.railY, z = S.centerZ;
  runCmd(`setworldspawn ${x} ${y + 1} ${z}`);
  runCmd(`spawnpoint @a ${x} ${y + 1} ${z}`);
  S.nextLoad += 16;
  // Re-anchor the ticking-area corridor on the new span (Java's forceload
  // cadence). Fire-and-forget: rollCorridor skips itself while a previous
  // create is still resolving.
  void rollCorridor();
  // Drop surface-probe memo entries the head has passed.
  for (const k of surfMemo.keys()) if (k < x) surfMemo.delete(k);
  if (debugOn()) {
    // Two-line health report per 16 blocks of head travel -- everything the
    // lurch hunt needs at a glance.
    // Line 1, the ride's geometry: the contiguous loaded frontier past the
    // head (steady state tracks the corridor's reach past the head --
    // ~+.TERRAIN_GENAHEAD at the defaults; consistently smaller =
    // generation is lagging the ride), the corridor's ticking-chunk count
    // against the manager budget (`tam`, with a `~` while a create is
    // still in flight and `!` if there is NO live corridor), the track
    // buffer `gap` (head - pace; .PACE_CART_BEHIND = full), the rider's
    // distance behind the head, and the pace speed as current/target with
    // the buffer's soft ceiling `cap` -- cap below target means the BUFFER
    // is what's limiting the ride (the Speed items can't help), a healthy
    // cap with a low speed means something else is.
    // Line 2, pipeline health over the window since the previous line:
    // effective ticks-per-second and the script's own avg/max tick cost --
    // paired with `lull`, the longest wall-clock gap BETWEEN engine ticks:
    // a big lull with a small tick cost = the ENGINE is stuttering (world
    // save/compaction, memory pressure), not this pack's work. `save` is
    // the worst single state-save write, `starve` how many ticks the
    // builder sat blocked on an unloaded chunk ahead, and badSamples/avg/
    // railY the terrain algorithm's live numbers (badSamples at the full
    // sample count = probe broken). ops = rig operations (mounts/ejects/
    // corrective teleports): all zeros while a problem is audible or
    // visible = the script is NOT doing it.
    let frontier = 0;
    while (frontier < 512 && chunkLoaded(x + frontier + 16, z)) frontier += 16;
    let tamTxt = '§c?§7';
    try {
      const mgr = tamgr();
      if (mgr) tamTxt = `§f${mgr.chunkCount}/${mgr.maxChunkCount}${corrBusy ? '~' : ''}${corrLive ? '' : '§c!§7'}§7`;
    } catch { /* manager unavailable */ }
    const gap = x - Math.floor(S.paceX);
    let riderTxt = '§coffline§7';
    try {
      const r = findRider();
      if (r) riderTxt = `§f-${Math.round(x - r.location.x)}§7`;
    } catch { /* unloaded */ }
    const spd = (S.paceSpeed * 20).toFixed(1);
    const tgt = Math.round(S.targetSpeed * 20);
    const cap = Math.max(0, ((x - camAhead() - 8 - S.paceX) / 40) * 20);
    const winMs = Math.max(1, Date.now() - dbgWin0);
    const tps = ((dbgWinTicks * 1000) / winMs).toFixed(1);
    const costAvg = dbgWinTicks ? (dbgTickCostSum / dbgWinTicks).toFixed(1) : '0';
    const sampleN = Math.max(1, Math.floor(cfg('SAMPLE_WINDOW') / Math.max(1, cfg('SAMPLE_BLOCK_INTERVAL'))));
    dbg(`x=${x}: loaded §f+${frontier}§7 tam=${tamTxt} gap=§f${gap}§7 rider=${riderTxt} spd=§f${spd}§7/${tgt} cap=§f${cap.toFixed(1)}§7\n   tps=§f${tps}§7 tick=§f${costAvg}/${dbgTickCostMax}§7ms lull=§f${dbgLullMax}§7ms save=§f${dbgSaveMax}§7ms starve=§f${dbgStarveTicks}§7/${dbgWinTicks} badSamples=§f${S.lastBad}§7/${sampleN} avg=§f${S.avg}§7 railY=§f${S.railY}§7 ops=§fm${ops.mount}/e${ops.eject}/t${ops.tp}§7 drive=${S.teleportFallback ? '§ctp§7' : 'imp'} bridge=${bridgeMode}`);
    ops.mount = 0; ops.eject = 0; ops.tp = 0;
  }
  // The health window resets whether or not it was printed, so the first
  // line after enabling debug mid-ride covers only the last 16 blocks
  // instead of the whole session.
  dbgWin0 = Date.now();
  dbgWinTicks = 0;
  dbgTickCostSum = 0;
  dbgTickCostMax = 0;
  dbgLullMax = 0;
  dbgSaveMax = 0;
  dbgStarveTicks = 0;
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
  const rigX = S.paceX + camAhead();
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
      // speed_up (RAISE-ONLY -- mirrors Java's speed_up). The ocean speed-up
      // must never SLOW the ride: on the ENTRY transition (!S.fast) the ocean
      // cruise .ocnspd is set to the config ocean speed, then bumped up to the
      // land speed .speed if that is higher -- max(.OCEANSPEED, .speed) -- so a
      // rider already going faster than the ocean speed keeps their speed
      // instead of being dropped to it. .speed is left untouched, holding the
      // pre-ocean speed for the land return (speed_down) to restore, and a
      // mid-sprint Reset still totals it to .DEFAULTSPEED.
      if (!S.fast) {
        const cruise = Math.max(cfg('OCEANSPEED'), landSpeed());
        setScore('ocnspd', cruise); // the cruise the sprint re-asserts every tick
        dbg(`§bentering ocean sprint, speed §f${cruise}`);
        S.fast = true;
        syncFast();
      }
      // Re-assert the cruise every tick: a mid-sprint Speed click / slider
      // updated .ocnspd (the active cruise while .fast is 1), so oceanSpeed()
      // carries the user's adjustment rather than snapping back.
      S.targetSpeed = oceanSpeed() / 20;
    }
  } else {
    S.landRun += 1;
    S.oceanRun = 0;
    if (S.landRun <= cfg('LANDCHUNKS')) {
      dbg(`§eland chunk - landRun=§f${S.landRun}§e/§f${cfg('LANDCHUNKS')}§7  speed=§f${(S.paceSpeed * 20).toFixed(1)}`);
    }
    if (S.fast && S.landRun >= cfg('LANDCHUNKS')) {
      // speed_down (RAISE-ONLY -- mirrors Java's speed_down). The cruise we
      // were just doing is .ocnspd (oceanSpeed()):
      //   - ABOVE the base ocean speed (came in fast, or sped up mid-sprint)
      //     -> keep it on land, so .speed becomes it -- never slow a fast
      //     rider on the way back;
      //   - the ocean speed or below -> restore the pre-ocean land speed .speed.
      // Reset then returns the land speed to the true default .DEFAULTSPEED.
      const cur = oceanSpeed();
      if (cur > cfg('OCEANSPEED')) setScore('speed', cur);
      const land = landSpeed();
      S.targetSpeed = land / 20;
      dbg(`§ereturning to land, speed §f${land}`);
      S.fast = false;
      syncFast();
    }
  }
}

// The virtual pace cart: eases toward the target speed and rolls east. This is
// what the hidden physical pace cart + always-powered rails + stall keeper +
// max-speed gamerule achieved on Java, in four lines.
let skyWas = false; // last tick's .SKYMODE, to catch the toggle-off transition
// The user-click detector's memory: last tick's target speed and speed
// context. A target that moved while the context did NOT means a Speed
// -/Reset/+ click (or the slider) changed the active cruise -- ease to it at
// the brisk ACCEL_CLICK until it is reached, then drop back to the gentle
// context ramp. (Module state: a /reload just re-learns it in one tick.)
let paceTargetWas = -1;
let paceCtxWas = '';
let paceClickEase = false;
function tickPace() {
  // Sky mode (mode_sky_on) owns the speed outright: the sky cruise (.skyspd,
  // the adjustable sky speed -- default .SKYSPEED, tuned by the Speed +/-
  // items and the Ride Settings slider while sky mode is on) is asserted every
  // tick, so it is live-tweakable; the moment sky mode turns off the ocean
  // system gets the speed back with fresh counters -- Java's mode_sky_off does
  // the same reset explicitly.
  const sky = modeOn('SKYMODE');
  if (sky) {
    S.targetSpeed = skySpeed() / 20;
  } else if (skyWas) {
    S.fast = false;
    syncFast();
    S.oceanRun = 0;
    S.landRun = 0;
    S.targetSpeed = landSpeed() / 20;
  } else if (S.fast) {
    S.targetSpeed = oceanSpeed() / 20; // the ocean cruise stays live-adjustable
  } else {
    S.targetSpeed = landSpeed() / 20; // the land speed stays live-adjustable
  }
  skyWas = sky;
  // A moved target under an UNCHANGED context = the user tuned the active
  // cruise; take the brisk ramp until it is reached. A context switch always
  // clears the flag -- those transitions keep the gentle rail-physics ramp.
  const ctx = sky ? 'sky' : S.fast ? 'ocean' : 'land';
  const tgt = Math.round(S.targetSpeed * 20);
  if (ctx !== paceCtxWas) paceClickEase = false;
  else if (paceTargetWas >= 0 && tgt !== paceTargetWas) paceClickEase = true;
  paceCtxWas = ctx;
  paceTargetWas = tgt;
  const accel = (paceClickEase ? ACCEL_CLICK : ACCEL) / 20;
  // Never let the ride outrun the built track (e.g. while world generation is
  // catching up). This is a SOFT ceiling: the allowed speed shrinks smoothly
  // with the remaining track buffer, so a starved builder reads as the ride
  // gently easing off -- a hard positional clamp here made the cart surge and
  // jerk whenever the buffer ran low at ocean speed.
  const headroom = (S.headX - camAhead() - 8) - S.paceX;
  const allowed = Math.max(0, Math.min(S.targetSpeed, headroom / 40));
  if (S.paceSpeed < allowed) S.paceSpeed = Math.min(allowed, S.paceSpeed + accel);
  else if (S.paceSpeed > allowed) S.paceSpeed = Math.max(allowed, S.paceSpeed - accel * 2);
  else if (S.paceSpeed === S.targetSpeed) paceClickEase = false; // arrived: back to the gentle ramp
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
  let ci = Math.floor(S.paceX) - S.trackBase + camAhead();
  ci = Math.min(Math.max(ci, 0), maxi);

  const r = camHeight({
    trackY: S.trackY, index: ci, fx,
    lift10: cfg('CAMLIFT'), blend: cfg('CAMBLEND'), smooth: cfg('CAMSMOOTH'),
    s2: S.s2,
  });
  S.s2 = r.s2;
  return r.sy;
}

// cam_move: fly the rig camAhead() blocks east of the pace position (i.e.
// .RIDER_BEHIND behind the build head) at the
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

// The cart's cell and the one in front of it (each plus the cell above --
// the cart is about a block tall) must never hold liquid: water right at the
// viewer splashes and drags, lava flashes the fire overlay even though the
// damage gamerules make it harmless. Java runs the same guard as a fill at
// its pace cart; here the rig IS the thing the player sees, so it runs at
// the cart. Adjacent sources re-flow, but this runs every tick.
function clearCartLiquids(target) {
  const bx = Math.floor(target.x);
  const by = Math.floor(target.y);
  const z = S.centerZ;
  for (const [dx, dy] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
    try {
      const b = dim.getBlock({ x: bx + dx, y: by + dy, z });
      if (b && b.isLiquid === true) dim.setBlockType({ x: bx + dx, y: by + dy, z }, 'minecraft:air');
    } catch { /* border chunk: retry next tick */ }
  }
}

// Dropped items and XP orbs near the rig are removed before the rider
// glides into pickup range -- the inventory keeper deletes pickups
// instantly, but the pickup SOUND still plays; sweeping them early keeps
// the ride silent. (Java sweeps the same radius around its camera seat.)
function sweepDrops(seat) {
  let center;
  try { center = seat.location; } catch { return; }
  for (const type of ['minecraft:item', 'minecraft:xp_orb']) {
    try {
      for (const e of dim.getEntities({ type, location: center, maxDistance: 16 })) {
        try { e.remove(); } catch { /* already gone */ }
      }
    } catch { /* query raced a chunk unload: retry next tick */ }
  }
}

// --- Minecart riding sound --------------------------------------------------
// Nothing on Bedrock rolls on rails (the pace is virtual, the cart prop is
// scripted scenery with none of the minecart's client-side behavior), so the
// sound a rider expects is re-created: while .SOUNDMODE is on
// (mode_sound_on/_off, the Ride Settings form's Sound toggle; config .CARTSOUND
// is only the first-load default, seeded by the shared modes_init), the
// vanilla FIRST-PERSON riding sample is RE-TRIGGERED at the rider every
// SOUND_LOOP_TICKS (115 -- the sample is 5.77 s = 115.4 ticks, so each copy
// starts just as the last one ends), exactly like Java's sound_loop clock.
// An earlier version played it ONCE and trusted the FSB's baked-in FMOD
// loop flag to run forever -- in practice the loop did NOT reliably engage
// when the file is played through the pack's own definition: the sample
// ended after one 5.8 s play and the ride went silent until the next
// 256-block re-anchor ("stops randomly, pops back on ~30 s later"), and a
// play emitted at a just-(re)joining client was dropped outright, leaving
// the whole ride mute while the script believed a loop was running. The
// fixed-cadence clock self-heals all of that within one cycle.
// Details that make it work:
//   1. every play is PRECEDED by a stopsound (the one-instance invariant):
//      if the FMOD loop flag does engage, the old copy dies at what is a
//      sample boundary anyway -- so no phasing stack can ever build up (the
//      original sin of the first timer-based attempt, which skipped the
//      stop and stacked an immortal looping copy every cycle);
//   2. the sound id is the RP's OWN definition (ir.cart_roll) pointing at
//      the vanilla file -- both because the global minecart.base EVENT is
//      silenced by this pack (the phantom-noise fixes) and because only a
//      pack-own definition can carry its own attenuation settings;
//   3. that definition sets min_distance 512: within that range the engine
//      applies NO distance attenuation, so a playing copy holds constant
//      volume as the ride glides away from where it was emitted -- and each
//      re-trigger re-anchors the emission at the rider, so drift can never
//      accumulate at any cruise speed (the SOUND_REANCHOR distance check
//      only matters beyond ~89 blocks/s, where one cycle outruns half the
//      guard band mid-sample).
// The rider-offline path resets soundOn so the clock restarts immediately
// when the ride resumes; stop() and mode_sound_off also stopsound. (Java
// data packs can't define or re-tune sounds at all -- Java instead
// /playsounds the same sample at volume 100 on its own 115-tick clock; the
// two editions now share the same cadence.)
const SOUND_LOOP_TICKS = 115; // the sample's length, 5.77 s, in ticks
const SOUND_REANCHOR = 256;
// A play emitted at a just-(re)joining client is dropped outright (the
// loading screen swallows it) -- and the clock then believes a copy is
// playing for the next 5.75 s, which is the "the cart sound only starts
// seconds after loading in" bug. There is no client-is-ready signal to wait
// on, so for a short window after any player join the loop re-anchors on a
// fast cadence instead: the first play the client actually receives lands
// within a second of its loading screen dropping, and once the window
// closes the cadence returns to the sample length. (The warm re-triggers a
// client already hears are stopsound-then-play restarts of a uniform
// rolling loop -- a far smaller evil than seconds of silence.)
const SOUND_JOIN_WARM = 200;  // ticks after a join on the fast cadence
const SOUND_WARM_TICKS = 20;  // the fast cadence itself
let lastJoinAt = -1e9;        // tickN of the latest initial player spawn
let soundOn = false;      // a copy is (believed) playing
let soundAnchorX = 0;     // world X where it was emitted
let soundStartedAt = -1e9; // tickN of the last (re)trigger
function resetSound() { soundOn = false; }
function tickSound() {
  if (!modeOn('SOUNDMODE')) {
    if (soundOn) { runCmd('stopsound @a ir.cart_roll'); soundOn = false; }
    return;
  }
  if (!S.riderName) return; // a surrogate ride has no client to hear anything
  const rider = findRider();
  if (!rider) return;
  let x;
  try { x = rider.location.x; } catch { return; }
  const period = tickN - lastJoinAt < SOUND_JOIN_WARM ? SOUND_WARM_TICKS : SOUND_LOOP_TICKS;
  if (soundOn
    && tickN - soundStartedAt < period
    && Math.abs(x - soundAnchorX) < SOUND_REANCHOR) return;
  runCmd('stopsound @a ir.cart_roll'); // the one-instance invariant
  try {
    rider.playSound('ir.cart_roll', { volume: 0.7, pitch: 1 });
  } catch {
    // playSound unavailable (API drift): the command route reaches the same
    // client-side sound.
    runCmd(`playsound ir.cart_roll "${S.riderName}"`);
  }
  soundOn = true;
  soundAnchorX = x;
  soundStartedAt = tickN;
}

function camMove(seat, cart, sy) {
  const target = {
    x: S.paceX + camAhead(),
    y: sy + CART_REST + cfg('CAMHEIGHT') / 10,
    z: S.centerZ + 0.5,
  };
  clearCartLiquids(target);
  // Live-diag capture: the seat's current distance from its glide target
  // (the same Manhattan metric glide's drift-catch tests against 4.0),
  // BEFORE this tick's correction is applied.
  if (diagActive) {
    try {
      const p = seat.location;
      diag.drift = Math.round((Math.abs(target.x - p.x) + Math.abs(target.y - p.y) + Math.abs(target.z - p.z)) * 100);
    } catch { diag.drift = -1; }
  }
  glide(seat, target);
  if (cart) {
    // The vanilla minecart geometry draws one block above a custom
    // entity's position (it expects the engine's internal renderer), so
    // the pack ships a re-based copy (geometry.ir_cart, all cubes shifted
    // down 16px -- measured in-game). .CARTYOFF (tenths of a block)
    // remains as a small fine-tune; large offsets would sink the cart
    // ENTITY into the track blocks, where it suffocates. The
    // vanilla-minecart fallback renders true and gets no offset.
    // Hide-minecart mode (.HIDECART -- mode_hidecart_*): the prop is kept
    // but glided at the fixed HIDE_CARTYOFF sink instead, below the track
    // line and out of the rider's view (both cart types).
    let cy = target.y;
    if (modeOn('HIDECART')) {
      cy += HIDE_CARTYOFF / 10;
    } else {
      try { if (cart.typeId === CART_TYPE) cy += cfg('CARTYOFF') / 10; } catch { /* stale */ }
    }
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

// Spawn just the scenery cart prop at a position (see spawnRig). Split out
// so a lost prop can be rebuilt alone, without touching the seat the rider
// is mounted on (the tick loop's cart-only heal).
function spawnCartProp(pos) {
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
  return cart;
}

// Spawn the rig at a position: the invisible seat (which the player will
// ride) and the unmounted cart prop that camMove glides along with it.
// Returns the seat (the mover), or throws if the chunk isn't ready. Any
// prior rig pieces are removed first so this can never duplicate.
function spawnRig(pos) {
  // Force the full findTagged scans (not the by-id fast path): this is the
  // one place that must see EVERY old rig piece before spawning fresh ones.
  seatScanAt = -1e9;
  cartScanAt = -1e9;
  const oldSeat = findSeat();
  if (oldSeat) { try { oldSeat.remove(); } catch { /* gone */ } }
  const oldCart = findCart();
  if (oldCart) { try { oldCart.remove(); } catch { /* gone */ } }
  S.seatId = '';
  S.cartId = '';

  const seat = dim.spawnEntity(SEAT_TYPE, pos);
  seat.addTag(TAG_SEAT);
  S.seatId = seat.id;

  spawnCartProp(pos);
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
// Anti-duplicate grace for the cart-only heal (hide-cart toggle-off, or a
// lost prop): ~1 s of "missing" before a new prop is spawned, so a
// merely-still-loading original is never doubled.
let cartMissing = 0;

// Is this player still "on the ride" for keeper purposes? Rides run in
// SURVIVAL (adventure suppresses Bedrock's natural mob spawning); switching
// to any other mode is the sanctioned way to leave.
function ridingMode(gm) {
  return gm === GameMode.Survival;
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
  // /ride only addresses PLAYERS by name; a non-player rider goes straight
  // to the API path below.
  if (S.riderName) {
    const r = runCmd(`ride "${S.riderName}" start_riding @e[type=${SEAT_TYPE},tag=${TAG_SEAT},c=1] teleport_rider`);
    if ((r?.successCount ?? 0) > 0) return true;
  }
  try {
    const seat = findSeat();
    const rider = findRider();
    if (seat && rider) {
      // A non-player rider gets the command's teleport_rider behavior by hand.
      if (!S.riderName) { try { rider.teleport(seat.location); } catch { /* chunk edge */ } }
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

  // Purity sweep: the seat carries exactly this ride's rider (a player
  // matched by NAME -- the most stable identity across handles -- or a
  // surrogate entity by id). Best-effort -- if the rider list
  // under-reports, nothing breaks; this is never used as a mount-state
  // check.
  try {
    for (const r of seatRideable.getRiders()) {
      let spare = false;
      try {
        spare = (r.typeId === 'minecraft:player' && r.name === S.riderName)
          || (!!S.riderId && r.id === S.riderId);
      } catch { /* stale */ }
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
  const riderIsPlayer = rider.typeId === 'minecraft:player';

  // Rider keeper (sneak-dismounts, rejoins): positional rule -- the seated
  // offset is 0.35, so anything under the threshold is "aboard". Only
  // survival/adventure players are recaptured -- switching to creative is
  // the sanctioned way to leave the ride and wander off. /ride's
  // teleport_rider brings a far-away rider (respawned at the rolled
  // spawnpoint) back to the rig as part of the mount. (A surrogate rider
  // has no game mode and is always recaptured.)
  if (!riderIsPlayer || ridingMode(rider.getGameMode())) {
    let riderFar = true;
    let d = -1;
    try { d = distToSeat(rider.location); riderFar = d > 2.5; } catch { /* treat as far */ }
    // Live-diag capture: the re-mount rule's actual inputs, per tick.
    if (diagActive) {
      diag.astray = d < 0 ? -1 : Math.round(d * 100);
      diag.astrayN = riderAstray;
    }
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

  // Everything below is player-only comfort (a surrogate rider has no
  // inventory, no client to see an arm, and no mobs care about it).
  if (!riderIsPlayer) return;

  // Keep the rider's inventory empty -- except the pinned hotbar items
  // (the Ride/Visual Settings, Tips and Debug menu items, Speed +/-) --
  // hiding held items and stopping item pickup. The HOTBAR (slots 0-8,
  // where the pins live and where a pickup lands first) is policed every
  // tick; the backpack slots (9+) only every 10 ticks -- sweepDrops kills
  // drops before they ever reach pickup range, so a backpack straggler is
  // a rare leak that can afford half a second, and the slow cadence cuts
  // ~27 container reads per tick from the keeper.
  try {
    const inv = rider.getComponent('minecraft:inventory')?.container;
    if (inv) {
      const backpackSweep = tickN % 10 === 0;
      for (let i = 0; i < inv.size; i++) {
        const want = PINNED_BY_SLOT[i];
        if (!want && i >= 9 && !backpackSweep) continue;
        const cur = inv.getItem(i);
        if (!want) {
          if (cur) inv.setItem(i, undefined);
        } else if (!cur || cur.typeId !== pinnedItemType(want) || cur.nameTag !== want.name) {
          // (This is also the one-time upgrade path: a save from the
          // vanilla-item era has its old speed items swapped for the custom
          // ones on the first kept tick.)
          try { inv.setItem(i, makePinnedItem(want)); } catch { /* unknown item id on this version: leave the slot empty */ }
        }
      }
    }
  } catch { /* container busy */ }

  // Mobs aggro (.AGGROMODE, default on -- mode_aggro_on/off): the rider's
  // invisibility effect is Bedrock's ONE vanilla lever over mob detection.
  // Invisible players are COMPLETELY unseen by hostile mobs here (no
  // sneaking creepers, no bow-draws, no chases -- why the ride used to
  // glide through the night in total silence), and the same effect is what
  // hid the first-person arm (the retired .HIDEHAND knob) -- so the two
  // are physically one setting: aggro OFF = invisible (mobs blind, arm +
  // F5 body hidden), aggro ON = visible (mobs react naturally, the arm
  // shows; the inventory keeper above still keeps the hand itself empty).
  // Re-asserted once a second so the toggle is live; stop() clears the
  // effect with the others.
  if (tickN % 20 === 0) {
    try {
      if (!modeOn('AGGROMODE')) {
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
function begin(rider) {
  // The algorithm reads Overworld surface heightmaps; refuse elsewhere (the
  // Java pack documents the same Overworld-only limitation).
  if (rider.dimension.id !== 'minecraft:overworld') {
    say('§cThe ride can only start in the Overworld.');
    return;
  }
  stop(true); // reset any previous run (silently)
  const gen = ++lifecycleGen;

  S.autodone = true;
  // The ride belongs to whoever begin ran for. A PLAYER is tracked by name;
  // any other entity -- e.g. the test suite's surrogate armor stand, the
  // same trick Java's suite uses -- by entity id (see findRider). The
  // player-only comforts (the /ride mount, gamemode, effects, hotbar items,
  // the riding sound) all no-op for a non-player.
  const isPlayer = rider.typeId === 'minecraft:player';
  S.riderName = isPlayer ? rider.name : '';
  S.riderId = isPlayer ? '' : rider.id;
  runCmd(`function ${NS}/setup_world`);

  const startX = Math.floor(rider.location.x);
  // The centerline snaps to Z ≡ 14 (mod 16) -- the chunk-tightest anchor:
  // the rail strip (z-1..z+1) sits at the top three offsets of ONE chunk
  // row, and the ±30 torch band spans exactly four rows (see
  // corridorOptions and the .TORCHRANGE config comment). The snap shifts
  // the line at most 14 blocks from where the starter stood; the launch
  // teleports them onto it anyway.
  const rawZ = Math.floor(rider.location.z);
  S.centerZ = rawZ + 14 - (((rawZ % 16) + 16) % 16);
  S.headX = startX;
  S.nextLoad = startX + 16;
  surfMemo.clear();

  // The corridor anchors on the virtual pace -- seed it at the start line
  // (beginPhase2 sets the real value later) so the first corridor spans
  // [start - tail .. start + .TERRAIN_GENAHEAD], generating everything the
  // launch poller below waits on. clearCorridor first: begin() must never
  // inherit a previous ride's span.
  clearCorridor();
  S.paceX = startX + 0.5;
  void rollCorridor();
  if (!tamgr()) {
    say('§eThis engine has no world.tickingAreaManager (script ticking areas). The ride cannot prepare terrain ahead -- it needs Bedrock 1.26.10+ with the FULL current behavior pack.');
  }

  S.paceSpeed = 0;
  S.targetSpeed = landSpeed() / 20;
  S.fast = false;
  syncFast();
  dbg(`ride speed set to §f${landSpeed()}§7 blocks/s`);

  // Wait (up to ~50 s) for the ticking area to load/generate both the start
  // column and the rig position (startX + camAhead(), where the ride cart
  // spawns), then finish the launch. Ticking-area generation is asynchronous
  // with no guaranteed latency, so this polls rather than assuming a delay.
  let waited = 0;
  const poll = system.runInterval(() => {
    if (lifecycleGen !== gen) { system.clearRun(poll); return; } // superseded
    waited += 1;
    if (waited === 40) say('§7Still generating the starting terrain...');
    const ready = chunkLoaded(startX, S.centerZ)
      && chunkLoaded(startX + camAhead(), S.centerZ);
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

// A launch that cannot finish must clean up after itself: release the
// corridor it created and persist the state it already mutated (autodone
// stays latched, started stays false), so nothing is leaked and a fresh
// start command works. Java's begin() is synchronous and cannot abort
// half-way.
function abortLaunch(reason) {
  say(`§cRide start aborted: ${reason}`);
  clearCorridor();
  saveState();
}

function beginPhase2(startX) {
  const rider = findRider();
  if (!rider) { abortLaunch('the starting rider left.'); return; }

  // Initial rail elevation = terrain surface here + hover altitude.
  const surf = surfaceY(startX, S.centerZ);
  if (surf === undefined) {
    say('§eWarning: the terrain probe returned nothing at the start position. If the track never follows the landscape, report this with your Minecraft version.');
  }
  S.railY = (surf ?? Math.floor(rider.location.y)) + cfg('HOVER');
  S.avg = S.railY - cfg('HOVER');

  // Initialize the shared brain's event-model state, exactly as begin does on
  // Java: flat, with a large flat-gap so the first slope is unrestricted (and
  // no leftover big-event gap credit from a previous ride: .evrun 0).
  brainSet('slope', 0);
  brainSet('flat', 99);
  brainSet('lastDir', 0);
  brainSet('evrun', 0);
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
  S.lastChunk = Math.floor((S.paceX + camAhead()) / 16);
  S.oceanRun = 0;
  S.landRun = 0;

  // Pre-build past the rig position so the viewer starts on ready track.
  const preBudget = camAhead() + 32;
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
    x: S.paceX + camAhead(),
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
    abortLaunch(`could not spawn the ride rig (${e}). If the terrain was still generating, run the start command again; otherwise make sure BOTH Scenic Rail packs (behavior + resource) are active and check the Content Log.`);
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
  if (rider.typeId === 'minecraft:player') {
    try {
      rider.runCommand('gamemode survival @s');
      rider.runCommand('effect @s resistance infinite 255 true');
      rider.runCommand('effect @s saturation infinite 0 true');
    } catch { /* effects are belt-and-suspenders on top of the damage gamerules */ }
    // No tutorial-hint toasts over the ride. /gametips is device-scoped, so it
    // only takes with a player executor -- it CANNOT live in setup_world (a
    // function run via dim.runCommand has none, and its mere presence there
    // makes Bedrock reject the whole file, dropping every safety gamerule).
    // Kept in its own try so a future /gametips change can never break seating.
    try { rider.runCommand('gametips disable'); } catch { /* best-effort; tips are cosmetic */ }
  }

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
    // Take the pinned hotbar items (the menu items, Tips, Speed -/Reset/+)
    // back -- the ride is over.
    try {
      const inv = rider.getComponent('minecraft:inventory')?.container;
      for (const def of PINNED) {
        const cur = inv?.getItem(def.slot);
        if (cur && (cur.typeId === def.type || cur.typeId === def.altType || cur.typeId === def.fallback) && cur.nameTag === def.name) {
          inv.setItem(def.slot, undefined);
        }
      }
    } catch { /* inventory unavailable */ }
  }
  S.camActive = false;
  // Stop the riding-sound loop (it plays natively forever -- see tickSound)
  // and forget it, so the next ride emits a fresh one wherever it starts.
  runCmd('stopsound @a ir.cart_roll');
  resetSound();
  // Give the HUD back: the Toggle HUD item leaves with the rest of the
  // hotbar, and a hidden HUD with no item to restore it strands the player.
  // The reset is harmless when nothing was hidden (a client-side F1 hide is
  // a different mechanism, untouched either way); the score write goes
  // through a command so cmd-bridge worlds reset too.
  runCmd('hud @a reset all');
  runCmd(`scoreboard players set ${P}HUDHIDDEN ir 0`);
  S.hudHidden = false;
  // Remove EVERY rig piece wearing our tags (there should be one of each, but
  // stale sessions may have left extras behind). Each type is collected under
  // its own guard so one unregistered type can't abort the whole sweep.
  if (dim) {
    const collect = (type, tag) => {
      try { return dim.getEntities({ type, tags: [tag] }); } catch { return []; }
    };
    const pieces = [
      ...collect(SEAT_TYPE, TAG_SEAT),
      ...collect(CART_TYPE, TAG_RIDE),
      ...collect('minecraft:minecart', TAG_RIDE), // the runtime cart-prop fallback
    ];
    for (const e of pieces) {
      try { e.getComponent('minecraft:rideable')?.ejectRiders(); } catch { /* empty */ }
      try { e.remove(); } catch { /* already gone */ }
    }
  }
  clearCorridor();
  S.cartId = '';
  S.seatId = '';
  saveState(); // .autodone stays set: a stopped world never auto-restarts
  if (!silent) say('§7Ride stopped.');
}

// Auto-start world-age gate (Java's auto_gate twin). Returns false -- and
// blocks the auto-start -- when this looks like an EXISTING/played world:
// world.getAbsoluteTime() (ticks the world has actually run, persisted in the
// save) is at least .WORLDAGEWARN minutes. It latches .autodone so the ride
// never auto-starts here and this never re-warns; a manual /function
// infinite_rail/start is unaffected. Returns true (let the countdown run) on a
// fresh world, when the guard is disabled (.WORLDAGEWARN 0), or if the engine
// can't answer the age query (fail-open -- auto-start as before rather than
// blocking every world).
function autoAgeGate() {
  const warnMin = cfg('WORLDAGEWARN');
  if (warnMin <= 0) return true;
  let ageTicks;
  try { ageTicks = world.getAbsoluteTime(); } catch { return true; }
  if (!(ageTicks >= warnMin * 1200)) return true; // also true when ageTicks is NaN/undefined
  S.autodone = true;
  saveState();
  say('§eThis world looks like it has already been played for a while, so the ride did NOT auto-start.');
  say('§7Scenic Rail Mode is meant for a §fFRESH world§7: it bulldozes a tunnel straight through everything in its path (your builds included), kills entities the cart passes and leaves behind, and locks you into the cart in adventure mode for the whole ride.');
  say('§7If you really do want to run it here anyway, start it manually with §b/function infinite_rail/start§7.');
  return false;
}

// tick.mcfunction's auto-starter: in a fresh world, begin the ride for the
// first player to appear after a 5-second countdown. Once per world, ever.
function autoStart() {
  if (S.autodone || cfg('AUTOSTART') !== 1) return;
  const players = world.getAllPlayers();
  if (players.length === 0) return;
  // First tick a player is present: gate on world age before the countdown
  // begins. A blocked (existing) world latches .autodone inside, so the top
  // guard returns next tick; a fresh world proceeds. Mirrors Java's auto_gate
  // running before the .start_timer increment.
  if (S.startTimer === 0 && !autoAgeGate()) return;
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
  // Create every objective the pack uses BEFORE config runs (a scoreboard
  // write into a missing objective fails silently on Bedrock). Created both
  // through the API and through a command so cmd-bridge worlds (split
  // scoreboards -- see bridgeTest) get the command-side copies too; each
  // call is a no-op wherever the objective already exists.
  for (const [id, label] of Object.entries(OBJ_DISPLAY)) {
    try { objective(id); } catch { /* API scoreboard unavailable */ }
    runCmd(`scoreboard objectives add ${id} dummy "${label}"`);
  }

  // Warm the custom-item probes and publish .itemsok (the keeper would get
  // there on its own once a ride runs, but probing here means the loud
  // didn't-resolve warning lands at load -- next to the config/self-test
  // diagnostics -- instead of mid-ride, and the test suite can assert the
  // score without starting a ride). Probes every pack-own id, fallback or
  // not; a failure here re-probes every ~30 s.
  for (const def of PINNED) {
    for (const t of [def.type, def.altType]) {
      if (t && t.startsWith(`${NS}:`)) customItemOk(t);
    }
  }

  AIR = BlockPermutation.resolve('minecraft:air');
  RAIL_FLAT = BlockPermutation.resolve('minecraft:rail', { rail_direction: 1 });
  RAIL_UP = BlockPermutation.resolve('minecraft:rail', { rail_direction: 2 });
  RAIL_DOWN = BlockPermutation.resolve('minecraft:rail', { rail_direction: 3 });
  SUPPORT = BlockPermutation.resolve('minecraft:smooth_stone');
  // A standing torch for torch mode (maybeTorch).
  try { TORCH = BlockPermutation.resolve('minecraft:torch', { torch_facing_direction: 'top' }); }
  catch { TORCH = BlockPermutation.resolve('minecraft:torch'); }
  // Sea pickle clusters 1..4 (cluster_count 0..3) for the water case. If the
  // states are unavailable, leave SEA_PICKLE null and maybeTorch skips water
  // like the old behavior rather than throwing.
  try {
    SEA_PICKLE = [null];
    for (let n = 1; n <= 4; n++) {
      SEA_PICKLE.push(BlockPermutation.resolve('minecraft:sea_pickle', { cluster_count: n - 1, dead_bit: false }));
    }
  } catch { SEA_PICKLE = null; }

  // Apply the tunable knobs from the SHARED config.mcfunction (the same file
  // Java runs from load.mcfunction). Editing config + /reload refreshes them
  // mid-ride, exactly like Java.
  const r = runCmd(`function ${NS}/config`);
  if (r === undefined) {
    say('§cconfig function failed to run -- using built-in defaults. Is the behavior pack fully installed?');
    for (const [k, v] of Object.entries(CONFIG_DEFAULTS)) {
      const obj = CFG_OBJ[k] ?? OBJ;
      if (getScore(k, undefined, obj) === undefined) setScore(k, v, obj);
    }
  }
  // The retired fixed build cap (replaced by .BUILD_FACTOR's speed-scaled
  // budget -- buildBudget()): clear the stale score out of upgraded worlds'
  // saves, or the cfg_ride sidebar view shows 16 rows and hides one.
  runCmd('scoreboard players reset .BUILD_PER_TICK cfg_ride');
  // Seed the ride-mode toggle scores (0 = off) if they've never been set --
  // the shared modes_init, same call Java makes from load.mcfunction. Modes
  // are state, not config: they live outside config.mcfunction so a /reload
  // never resets an enabled mode.
  runCmd(`function ${NS}/modes_init`);
  // Cross-edition internal constants (the shared consts.mcfunction, same
  // call Java makes from load.mcfunction): .SPEEDSTEP & co. -- fixed
  // numbers deliberately kept out of the user config.
  runCmd(`function ${NS}/consts`);

  // The distance knobs' ordering invariant (all measured from the build
  // head; Java's load warns the same way): a rig at or behind the pace
  // position glides over unsmoothed track and the ocean check samples the
  // wrong chunk. (.SAMPLE_WINDOW vs .TERRAIN_GENAHEAD matters here too now
  // -- corridorOptions floors the corridor's reach at the sample window, so
  // the invariant only affects how far PAST the window terrain is prepared.)
  if (camAhead() <= 0) {
    say('§eConfig warning: .RIDER_BEHIND must stay BELOW .PACE_CART_BEHIND (the camera rig has to ride ahead of the hidden pace position). The ride will misbehave until one of them is adjusted.');
  }

  loadState();
  // Ticking-area hygiene on every load: drop whatever areas a previous
  // session/reload left in this pack's manager (a resumed ride rebuilds its
  // corridor just below; a stopped world should hold none at all).
  clearCorridor();
  // Re-assert the world-tuning gamerules in any world whose ride has
  // already started (Java's load does the same): begin() applies them at
  // ride start, but a world that started under an older/broken pack build
  // keeps its rules until something re-applies them -- this heals such
  // worlds on the next load instead of requiring a full ride restart.
  if (S.started) runCmd(`function ${NS}/setup_world`);
  // A resumed ride needs its corridor back before the builder can move (and
  // before the rider's chunk can load on a headless resume).
  if (S.started) void rollCorridor();
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

// The riding-sound warm window's trigger (see tickSound): remember when a
// player joins, because plays emitted while their client is still on the
// loading screen are dropped. Guarded subscribe, same reasoning as
// playerInteractWithBlock below -- losing this signal must only cost the
// warm-up, never the whole script.
try {
  world.afterEvents.playerSpawn.subscribe((ev) => {
    if (!ev.initialSpawn) return;
    lastJoinAt = tickN;
    // Un-hide the HUD on every join. Rejoining a world restores the HUD by
    // default (the client resets /hud on world load), but the persisted
    // .HUDHIDDEN score still reads "hidden", so the inventory keeper keeps
    // pinning slot 2's fully-transparent held-as-nothing variant
    // (infinite_rail:toggle_hud) -- an empty hand over an already-visible
    // HUD, and no way to tell what's held. Clear the state to match the
    // restored HUD so the keeper swaps the crossed-out-eye icon
    // (toggle_hud_shown) back in; harmless when nothing was hidden (a
    // client-side F1 hide is a different mechanism, untouched either way).
    // Quiet -- no "HUD restored" chat, unlike the Toggle HUD item's toggle.
    // Same three lines stop() uses; the score write goes through a command
    // so cmd-bridge worlds reset too.
    runCmd('hud @a reset all');
    runCmd(`scoreboard players set ${P}HUDHIDDEN ir 0`);
    S.hudHidden = false;
    saveState();
  });
} catch { /* signal unavailable: the warm window simply never arms */ }

// The No-Thunderstorms watch (.STORMMODE 1 -- the Visual Settings form's
// Thunderstorms toggle turned off; Java's twin is the storm_watch tick
// hook): the moment the NATURAL weather cycle rolls a thunderstorm, re-roll
// it as plain rain -- no duration given, so vanilla picks its usual random
// rain length and the weather keeps cycling (the sky just never thunders).
// Permanent rain (.RAINMODE) stands the watch down: its frozen cycle only
// ever rains, and the suppression is only meant for the natural cycle
// anyway. Guarded subscribe like playerSpawn above -- losing the signal
// must only cost this feature, never the whole script.
try {
  world.afterEvents.weatherChange.subscribe((ev) => {
    try {
      // Track EVERY change into S.weather (persisted below) -- current
      // @minecraft/server ships no Dimension.getWeather() (2.3.0 throws
      // "not a function"), so this event stream is the only sky read the
      // script has, and stormWatchNow() answers from the tracked value.
      S.weather = String(ev.newWeather);
      saveState();
      if (ev.newWeather !== WeatherType.Thunder) return;
      if (!ensureInit()) return;
      if (!modeOn('STORMMODE') || modeOn('RAINMODE')) return;
      runCmd('weather rain');
    } catch (e) { reportError('storm watch', e); }
  });
} catch { /* signal unavailable: thunderstorms simply stay vanilla */ }

// The look-at-the-sky half of the watch: the event above only sees weather
// CHANGES, so a storm already raging when the mode lands -- a world loaded
// mid-thunder, or mode_storms_off run from chat during one -- would ride
// out untouched. Called every 100 ticks from the tick driver (the catch-all,
// matching Java's per-tick storm_watch within ~5 s) and from the Visual
// form's toggle handler (instant conversion on the click). The cmd-bridge
// mode cache is dropped first (the form reads .STORMMODE while building
// itself, and a click lands well inside the ~1 s cache window); the sky
// itself is read from the event-tracked S.weather (see the body).
function stormWatchNow() {
  modeCache.delete('STORMMODE');
  if (!modeOn('STORMMODE') || modeOn('RAINMODE')) return;
  // Prefer a live API read where one exists, but current @minecraft/server
  // has no Dimension.getWeather() (2.3.0 throws), so the working answer is
  // the TRACKED S.weather -- every weatherChange since boot updates it and
  // it persists in the save (ir:state), so a world reopened mid-storm still
  // knows. Blind spot: a stormy world whose save predates the tracking (or
  // the pack) reads unknown until the next weather change -- that one storm
  // simply rides out.
  let w = S.weather;
  try { w = String(dim.getWeather()); } catch { /* not in this API version */ }
  if (w === String(WeatherType.Thunder)) runCmd('weather rain');
}

system.afterEvents.scriptEventReceive.subscribe((ev) => {
  try {
    if (!ensureInit()) { say('§cThe pack is not initialized yet -- see any error above.'); return; }
    if (ev.id === `${NS}:start`) {
      // Start at the triggering entity if there is one (parity with Java's
      // "execute as @p" -- and, like Java's begin, ANY entity may own the
      // ride: the headless test suite starts one as a tagged armor stand
      // via `execute as ... run scriptevent`), else at the nearest player
      // to spawn.
      const rider = ev.sourceEntity ?? world.getAllPlayers()[0];
      if (rider) begin(rider);
      else say('§cNo player online to start the ride at.');
    } else if (ev.id === `${NS}:stop`) {
      stop(false);
    }
  } catch (e) {
    reportError('start/stop command', e);
  }
}, { namespaces: [NS] });

// The pinned hotbar items: using one (right-click / hold) opens its menu or
// nudges the speed. Because most of the items are placeable blocks/carts
// chosen for their icons (rails, smithing table, soul campfire, chest
// minecart), one click can arrive through TWO events -- itemUse (aiming at
// air) and playerInteractWithBlock (aiming at a block, which is also
// CANCELLED so the survival rider can't build the icon into the world; the
// old itemUseOn events were REMOVED in @minecraft/server 2.0.0) -- so both paths
// funnel through one handler behind one shared debounce (a single click
// must mean a single action / one .SPEEDSTEP notch, and holding the use
// button re-fires the events). Matched by type + name + rider so nothing
// else can trigger anything.
let lastPinnedUseAt = -1e9;
function handlePinnedUse(player, item) {
  if (!inited || !S.started) return;
  if (!item || player?.typeId !== 'minecraft:player' || player.name !== S.riderName) return;
  const def = PINNED.find((d) => (d.type === item.typeId || d.altType === item.typeId || d.fallback === item.typeId) && d.name === item.nameTag);
  if (!def) return;
  // One physical click can arrive TWICE -- itemUse fires on the click's tick
  // and the cancelled interact path re-delivers via system.run a tick later
  // -- so 2 ticks is the smallest window that still folds the pair into one
  // action. For the SPEED items that tiny window is the WHOLE debounce:
  // distinct clicks (and a held button's refires) land as fast as the client
  // sends them, matching Java's stat-counted items (click or hold at any
  // rate, every one counts). The menu items keep a longer window, so a
  // double-delivered click can't pop a form open twice. Toggle HUD gets the
  // longest: no form opens to swallow a held button's refires, and a rapid
  // re-fire on a TOGGLE strobes the whole HUD on and off.
  const isSpeedItem = def.name === SPEED_UP_NAME || def.name === SPEED_DOWN_NAME || def.name === SPEED_RESET_NAME;
  if (tickN - lastPinnedUseAt < (isSpeedItem ? 2 : def.name === HUD_NAME ? 10 : 4)) return;
  lastPinnedUseAt = tickN;
  if (def.name === RIDE_NAME) showRideMenu(player);
  else if (def.name === VISUAL_NAME) showVisualMenu(player);
  else if (def.name === HUD_NAME) toggleHud();
  else if (def.name === TIPS_NAME) showTips(player);
  else if (def.name === DEBUG_NAME) showDebugMenu(player);
  else if (def.name === SPEED_UP_NAME) runCmd(`function ${NS}/speed_inc`);
  else if (def.name === SPEED_DOWN_NAME) runCmd(`function ${NS}/speed_dec`);
  else if (def.name === SPEED_RESET_NAME) runCmd(`function ${NS}/speed_reset`);
}
world.afterEvents.itemUse.subscribe((ev) => {
  try {
    handlePinnedUse(ev.source, ev.itemStack);
  } catch (e) {
    reportError('hotbar menu', e);
  }
});
// NOTE: this is playerInteractWithBlock, NOT itemUseOn -- @minecraft/server
// 2.0.0 (the manifest's dependency line) removed the itemUseOn before/after
// events in favor of this one. The subscribe itself is guarded: a missing
// event signal would throw HERE, at module load, and kill the entire script
// (no tick loop, no autostart, no keeper -- everything registered below it
// would silently never run), so a future rename degrades to losing only the
// aim-at-a-block path instead of the whole pack.
try {
  world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
    try {
      if (!inited || !S.started) return;
      const item = ev.itemStack; // optional: empty-hand interactions carry none
      const player = ev.player;
      if (!item || player?.name !== S.riderName) return;
      if (!PINNED.some((d) => (d.type === item.typeId || d.altType === item.typeId || d.fallback === item.typeId) && d.name === item.nameTag)) return;
      // Never place a menu item's block/cart (or a stale save's old vanilla
      // speed item), and never let a pinned-item click interact with a
      // passing lever/door/chest; run the real action outside the
      // before-event's read-only window (forms can't open inside it).
      // Every event in the gesture's chain is cancelled (not just
      // isFirstEvent); the debounce in handlePinnedUse keeps the action
      // single-fire. The custom speed items have no block to place, so for
      // them this cancel costs no client-side rollback (nothing was
      // predicted) -- which is what keeps hotbar scrolling clean around
      // the speed trio.
      ev.cancel = true;
      system.run(() => {
        try { handlePinnedUse(player, item); } catch (e) { reportError('hotbar menu', e); }
      });
    } catch (e) {
      reportError('hotbar menu', e);
    }
  });
} catch (e) {
  console.warn(`[Scenic Rail] playerInteractWithBlock unavailable (${e}); pinned items only respond when aimed at air`);
}

system.runInterval(() => {
  tickN += 1;
  // Tick-health bookkeeping for the debug roll line (two Date.now() calls
  // per tick -- negligible). The lull (wall-clock gap between consecutive
  // ticks) is measured start-to-start so it includes everything the engine
  // did between our slices; tick cost is this script's own work only.
  const t0 = Date.now();
  if (dbgPrevTickAt > 0) {
    const lull = t0 - dbgPrevTickAt;
    if (lull > dbgLullMax) dbgLullMax = lull;
    dbgLastLull = lull;
  }
  dbgPrevTickAt = t0;
  try { tick(); } catch (e) { reportError('tick', e); }
  const dt = Date.now() - t0;
  dbgWinTicks += 1;
  dbgTickCostSum += dt;
  if (dt > dbgTickCostMax) dbgTickCostMax = dt;
  dbgLastCost = dt;
});

function tick() {
  if (!ensureInit()) return;

  // The No-Thunderstorms catch-all sweep (Java's storm_watch twin, §6.9):
  // the weatherChange watch converts new storms instantly but only ever
  // sees CHANGES -- this picks up a storm already raging when the mode
  // lands (a world loaded mid-thunder, mode_storms_off run from chat).
  // World state like rain mode, so it runs before the started/rider gates.
  if (tickN % 100 === 0) { try { stormWatchNow(); } catch (e) { reportError('storm watch', e); } }

  if (!S.started) { autoStart(); return; }

  // Rider offline: freeze the whole ride until they return. (Java pauses the
  // same way in practice -- its pace cart stops being simulated when its
  // chunks unload -- but the virtual pace here would happily roll on and
  // build track through terrain nobody is watching.) The riding-sound state
  // resets too: a rejoining client has no sound instances, so the loop must
  // be re-emitted when the ride resumes.
  if (!findRider()) { resetSound(); return; }

  // The Live-diagnostics sidebar's gate, refreshed once per tick BEFORE the
  // capture points in camMove/keepers run: while the view is off this is
  // the feature's whole cost (one score read).
  diagActive = getScore('SIDEBAR', 0) === 5;

  // Per-tick driver, mirroring main.mcfunction's order:
  tickPace();                       // 1.  pace cart X (virtual)
  oceanCheck();                     // 1a. ocean speed-up
  // 1b. corridor self-heal: rollChunks re-anchors it per 16 blocks of head
  // travel, but a corridor lost to an error (or a resume raced by chunk
  // loading) must come back even while the head is pinned.
  if (!corrLive && !corrBusy && tickN % 100 === 0) void rollCorridor();
  let seat = findSeat();
  let cart = findCart();
  // A lost cart prop (killed by something) heals CART-ONLY, at the rig,
  // after a short anti-duplicate grace -- never via spawnRig, which would
  // unseat the rider. (Hide-cart mode doesn't remove the prop; camMove just
  // sinks it below the track line.)
  if (seat && !cart) {
    cartMissing += 1;
    if (cartMissing > 20) {
      cartMissing = 0;
      try { cart = spawnCartProp(seat.location); } catch { /* chunk not ready */ }
    }
  } else {
    cartMissing = 0;
  }
  if (!seat) {
    // The seat got lost (killed, or its chunk hasn't loaded back in after
    // a rejoin). Wait a grace period before rebuilding the rig -- respawning
    // instantly while the original was merely still loading is exactly what
    // used to duplicate carts -- then re-summon on the rig position, the same
    // self-healing job as Java's mount keepers. (A missing CART with the
    // seat intact never lands here -- the cart-only heal above rebuilds it
    // without unseating the rider.)
    S.rigMissing += 1;
    if (S.rigMissing > 40) {
      const sy = camFollow();
      const rigX = S.paceX + camAhead();
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
        if (rider && rider.typeId === 'minecraft:player'
          && ridingMode(rider.getGameMode())
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
  if (seat) {
    keepers(seat);                  // 2-4. eject strangers, re-seat the rider
    sweepDrops(seat);               // 5.  no pickup sounds: drops die early
    const sy = camFollow();         // 6.  the smoothed rail-line height
    if (sy !== undefined) camMove(seat, cart, sy); // glide seat (+ prop if shown)
  }
  tickSound();                      // 6b. minecart rolling sound (.SOUNDMODE)
  buildLoop();                      // 7.  extend the track
  tickStateSidebar();               // 8.  the Debug menu's Live state mirror
  tickDiagSidebar();                // 8b. the Live rig & tick diagnostics view

  if (--saveCountdown <= 0) { saveState(); saveCountdown = 40; }
}
