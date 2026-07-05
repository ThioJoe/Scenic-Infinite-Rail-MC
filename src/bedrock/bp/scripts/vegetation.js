// =============================================================================
//  Vegetation the carve must SPARE -- Bedrock Edition
//  Outside the critical envelope, natural vegetation survives -- trees, leaves,
//  mushrooms, bamboo, plants, sugar cane, etc. Terrain blocks (stone, dirt,
//  sand) always carve.
//
//  This file evaluates block typeIds at runtime.
// =============================================================================

const BEDROCK_EXACT = new Set([
    // Trees: logs, wood, giant-mushroom stems
    'mangrove_roots',
    'muddy_mangrove_roots',

    // Saplings & small trees
    'azalea',
    'flowering_azalea',
    'mangrove_propagule',

    // Sugar cane
    'reeds', // Bedrock's id for sugar cane

    // Grasses, ferns & bushes (Exact IDs only so "grass" doesn't spare grass_block)
    'short_grass',
    'tall_grass',
    'fern',
    'large_fern',
    'deadbush',
    'dead_bush',
    'bush',
    'firefly_bush',
    'short_dry_grass',
    'tall_dry_grass',
    'sweet_berry_bush',

    // Flowers & petals
    'poppy',
    'dandelion',
    'blue_orchid',
    'allium',
    'azure_bluet',
    'red_tulip',
    'orange_tulip',
    'white_tulip',
    'pink_tulip',
    'oxeye_daisy',
    'cornflower',
    'lily_of_the_valley',
    'wither_rose',
    'torchflower',
    'pitcher_plant',
    'sunflower',
    'lilac',
    'rose_bush',
    'peony',
    'pink_petals',
    'wildflowers',
    'spore_blossom',

    // Vines & hanging growth
    'glow_lichen',
    'hanging_roots',

    // Crops & farm plants (villages, pumpkin/melon patches)
    'pumpkin',
    'melon_block',
    'cocoa',
    'wheat',
    'carrots',
    'potatoes',
    'beetroot',
    'torchflower_crop',
    'pitcher_crop',

    // Water plants & coral
    'kelp',
    'seagrass',
    'waterlily', // Bedrock's id for lily pad
    'sea_pickle'
]);

const BEDROCK_FRAGMENTS = [
    // Trees: logs, wood, giant-mushroom stems (matches melon/pumpkin/nether stems too)
    '_log',
    '_wood',
    '_stem',
    'bamboo_block',

    // Leaves & leaf litter
    'leaves',
    'leaf_litter',

    // Saplings & small trees
    '_sapling',

    // Mushrooms (small + giant caps)
    'mushroom',

    // Bamboo
    'bamboo',

    // Cactus
    'cactus',

    // Flowers & petals
    'flower',

    // Vines & hanging growth
    'vine',
    'hanging_moss',

    // Moss carpets (moss BLOCKS are ground and still carve)
    'moss_carpet',

    // Water plants & coral
    'coral'
];

export function isVegetation(typeId) {
    if (typeof typeId !== 'string' || !typeId.startsWith('minecraft:'))
        return false;
    // Custom-namespace blocks (like infinite_rail:support) will never be misread
    // as vegetation because we strip the namespace and only check vanilla ids.
    const name = typeId.slice('minecraft:'.length);

    if (BEDROCK_EXACT.has(name))
        return true;

    for (const f of BEDROCK_FRAGMENTS) {
        if (name.includes(f))
            return true;
    }
    return false;
}
