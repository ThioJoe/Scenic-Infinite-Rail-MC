// =============================================================================
//  Blocks that are NOT terrain -- Bedrock Edition
//  The surface probe's dig-down list (probeSurface in main.js): after the
//  topmost-block read, the probe keeps stepping DOWN through these until it
//  stands on real ground, so trees, giant mushrooms and man-made structures
//  (village houses, ruined portals, witch huts...) never read as terrain
//  height. Water is deliberately NOT here: a liquid surface counts as
//  terrain, exactly like Java's heightmap (oceans read as sea level and get
//  bridged). Natural ground that villages merely reuse (dirt paths, plain
//  sandstone, terracotta -- badlands strata!) is NOT here either: ignoring
//  it would dig whole biomes hollow.
//
//  All natural vegetation (vegetation.js) is not-terrain too; this file only
//  adds the man-made / structure blocks on top and delegates the rest.
//
//  Java's edition of this list is the #infinite_rail:not_terrain block tag
//  (src/java/data/infinite_rail/tags/block/not_terrain.json) -- like the
//  vegetation pair, the two files are hand-maintained in policy sync (the
//  editions' block ids and grouping mechanisms differ anyway).
// =============================================================================

import { isVegetation } from './vegetation.js';

const MANMADE_EXACT = new Set([
    // Village / structure furniture & fixtures
    'bed',
    'bell',
    'bookshelf',
    'barrel',
    'composter',
    'lectern',
    'loom',
    'grindstone',
    'crafting_table',
    'cartography_table',
    'fletching_table',
    'smithing_table',
    'hay_block',
    'iron_bars',
    'carved_pumpkin',
    'packed_mud',

    // Worked stone (exact ids: their raw cousins are natural terrain)
    'smooth_stone',
    'smooth_sandstone',
    'cut_sandstone',
    'chiseled_sandstone',
    'smooth_red_sandstone',
    'cut_red_sandstone',
    'chiseled_red_sandstone',

    // Snow layers on roofs/trunks (snowy villages); snow BLOCKS stay terrain
    'snow_layer',
]);

const MANMADE_FRAGMENTS = [
    // Wood construction
    'planks',
    'fence',   // fences + fence gates
    'door',    // doors + trapdoors

    // Shaped blocks (never generate as raw terrain)
    'stairs',
    'slab',
    '_wall',

    // Glass, wool & carpets
    'glass',   // blocks + panes, plain/stained/tinted
    'wool',
    'carpet',

    // Worked stone families
    'brick',        // bricks, stone/mud/nether/deepslate bricks (legacy stonebrick too)
    'cobblestone',  // + mossy
    'polished',

    // Workstations & fixtures with variant ids
    'furnace',      // furnace, blast_furnace, lit_ variants
    'smoker',
    'stonecutter',
    'cauldron',
    'campfire',  // campfire + soul_campfire
    'anvil',
    'chest',        // chest, trapped_chest, ender_chest
    'lantern',      // lantern, soul_lantern, jack_o_lantern (sea_lantern is underwater anyway)
];

export function isNotTerrain(typeId) {
    if (typeof typeId !== 'string' || !typeId.startsWith('minecraft:'))
        return false;
    const name = typeId.slice('minecraft:'.length);

    if (MANMADE_EXACT.has(name))
        return true;

    for (const f of MANMADE_FRAGMENTS) {
        if (name.includes(f))
            return true;
    }
    // Everything the carve spares is not terrain either: trees (logs, leaves),
    // giant mushrooms, bamboo, cactus, pumpkins/melons, crops...
    return isVegetation(typeId);
}
