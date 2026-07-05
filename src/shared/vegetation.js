// =============================================================================
//  Vegetation the carve must SPARE -- the single source of truth, both editions
//
//  The track's clearance bore no longer flattens everything in its 3-wide box:
//  outside the critical envelope (the rail cell and the cell above it, plus
//  the full center bore on and around slopes) natural vegetation survives --
//  trees, leaves, giant mushrooms, bamboo, plants, sugar cane, and friends.
//  Terrain blocks (stone, dirt, sand, ...) always carve, so tunnels through
//  mountains are unchanged.
//
//  WHAT counts as vegetation is defined once, here, as a category table with
//  both editions' realizations side by side:
//
//    - Java has block TAGS in commands, so each category lists the vanilla
//      group tags (future blocks join automatically when Mojang extends a
//      tag) plus the block ids no vanilla tag covers. tools/build.mjs turns
//      these into the data pack's #infinite_rail:keep block tag
//      (data/infinite_rail/tags/block/keep.json), which carve_layer tests
//      with `execute unless block ... #infinite_rail:keep`.
//
//    - Bedrock has NO block tags in commands, so each category lists id
//      matchers (exact ids and name fragments) evaluated at runtime by
//      isVegetation(), which scripts/main.js imports (the build copies this
//      file into the behavior pack as scripts/vegetation.js). Some ids also
//      simply differ on Bedrock (sugar cane is "reeds", a lily pad is
//      "waterlily") -- this table is where those dialect spellings live.
//
//  HOW cells get cleared (fills, per-cell checks, the slope exception) is
//  edition machinery and lives in src/java's carve functions / src/bedrock's
//  placeColumn() -- see CONTEXT.md. The shared brain decides WHICH columns
//  may spare vegetation at all (the #veg / #vclear / #retro scores).
//
//  Individual Java block ids are emitted with "required": false so a future
//  rename can never break pack loading (the tag just drops that entry).
// =============================================================================

// Each category: a human name, Java vanilla-tag references (without the #),
// Java block ids not covered by those tags, exact Bedrock ids, and Bedrock id
// fragments (substring matches on the typeId with the namespace stripped).
const CATEGORIES = [
  {
    name: 'trees: logs, wood, giant-mushroom stems',
    javaTags: ['minecraft:logs', 'minecraft:bamboo_blocks'],
    javaBlocks: ['minecraft:mangrove_roots', 'minecraft:muddy_mangrove_roots', 'minecraft:mushroom_stem'],
    bedrockIds: ['mangrove_roots', 'muddy_mangrove_roots'],
    // _stem also matches melon/pumpkin/mushroom stems and nether fungi stems:
    // all plant matter, all meant to survive.
    bedrockFragments: ['_log', '_wood', '_stem', 'bamboo_block'],
  },
  {
    name: 'leaves & leaf litter',
    javaTags: ['minecraft:leaves'],
    javaBlocks: ['minecraft:leaf_litter'],
    bedrockIds: [],
    bedrockFragments: ['leaves', 'leaf_litter'],
  },
  {
    name: 'saplings & small trees',
    javaTags: ['minecraft:saplings'], // includes azalea flavors + mangrove_propagule
    javaBlocks: [],
    bedrockIds: ['azalea', 'flowering_azalea', 'mangrove_propagule'],
    bedrockFragments: ['_sapling'],
  },
  {
    name: 'mushrooms (small + giant caps)',
    javaTags: [],
    javaBlocks: ['minecraft:brown_mushroom', 'minecraft:red_mushroom',
      'minecraft:brown_mushroom_block', 'minecraft:red_mushroom_block'],
    bedrockIds: [],
    bedrockFragments: ['mushroom'],
  },
  {
    name: 'bamboo',
    javaTags: [],
    javaBlocks: ['minecraft:bamboo', 'minecraft:bamboo_sapling'],
    bedrockIds: [],
    bedrockFragments: ['bamboo'],
  },
  {
    name: 'sugar cane & cactus',
    javaTags: [],
    javaBlocks: ['minecraft:sugar_cane', 'minecraft:cactus', 'minecraft:cactus_flower'],
    bedrockIds: ['reeds'], // Bedrock's id for sugar cane
    bedrockFragments: ['cactus'],
  },
  {
    name: 'grasses, ferns & bushes',
    javaTags: [],
    javaBlocks: ['minecraft:short_grass', 'minecraft:tall_grass', 'minecraft:fern',
      'minecraft:large_fern', 'minecraft:dead_bush', 'minecraft:bush',
      'minecraft:firefly_bush', 'minecraft:short_dry_grass', 'minecraft:tall_dry_grass',
      'minecraft:sweet_berry_bush'],
    // exact ids only -- a "grass" fragment would wrongly spare grass_block
    bedrockIds: ['short_grass', 'tall_grass', 'fern', 'large_fern', 'deadbush',
      'dead_bush', 'bush', 'firefly_bush', 'short_dry_grass', 'tall_dry_grass',
      'sweet_berry_bush'],
    bedrockFragments: [],
  },
  {
    name: 'flowers & petals',
    javaTags: ['minecraft:flowers'], // small + tall flowers, petals, wildflowers
    javaBlocks: ['minecraft:spore_blossom'],
    bedrockIds: ['poppy', 'dandelion', 'blue_orchid', 'allium', 'azure_bluet',
      'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'oxeye_daisy',
      'cornflower', 'lily_of_the_valley', 'wither_rose', 'torchflower',
      'pitcher_plant', 'sunflower', 'lilac', 'rose_bush', 'peony',
      'pink_petals', 'wildflowers', 'spore_blossom'],
    bedrockFragments: ['flower'],
  },
  {
    name: 'vines & hanging growth',
    javaTags: [],
    javaBlocks: ['minecraft:vine', 'minecraft:glow_lichen', 'minecraft:hanging_roots',
      'minecraft:cave_vines', 'minecraft:cave_vines_plant',
      'minecraft:weeping_vines', 'minecraft:weeping_vines_plant',
      'minecraft:twisting_vines', 'minecraft:twisting_vines_plant',
      'minecraft:pale_hanging_moss'],
    bedrockIds: ['glow_lichen', 'hanging_roots'],
    bedrockFragments: ['vine', 'hanging_moss'],
  },
  {
    name: 'moss carpets (moss BLOCKS are ground and still carve)',
    javaTags: [],
    javaBlocks: ['minecraft:moss_carpet', 'minecraft:pale_moss_carpet'],
    bedrockIds: [],
    bedrockFragments: ['moss_carpet'],
  },
  {
    name: 'crops & farm plants (villages, pumpkin/melon patches)',
    javaTags: ['minecraft:crops'],
    javaBlocks: ['minecraft:pumpkin', 'minecraft:melon', 'minecraft:cocoa',
      'minecraft:attached_pumpkin_stem', 'minecraft:attached_melon_stem'],
    bedrockIds: ['pumpkin', 'melon_block', 'cocoa', 'wheat', 'carrots',
      'potatoes', 'beetroot', 'torchflower_crop', 'pitcher_crop'],
    bedrockFragments: [],
  },
  {
    name: 'water plants & coral',
    javaTags: ['minecraft:corals', 'minecraft:coral_blocks', 'minecraft:wall_corals'],
    javaBlocks: ['minecraft:kelp', 'minecraft:kelp_plant', 'minecraft:seagrass',
      'minecraft:tall_seagrass', 'minecraft:lily_pad', 'minecraft:sea_pickle'],
    bedrockIds: ['kelp', 'seagrass', 'waterlily', 'sea_pickle'],
    bedrockFragments: ['coral'],
  },
];

// ---------------------------------------------------------------------------
// Java: the values array for the #infinite_rail:keep block tag. EVERY entry
// (vanilla tag references included) is emitted with "required": false, so a
// future rename or removal in some 26.x snapshot degrades to "that plant gets
// carved again" instead of breaking the whole data pack's tag loading.
// ---------------------------------------------------------------------------
export function javaKeepTagValues() {
  const values = [];
  for (const c of CATEGORIES) {
    for (const t of c.javaTags) values.push({ id: `#${t}`, required: false });
    for (const b of c.javaBlocks) values.push({ id: b, required: false });
  }
  return values;
}

// ---------------------------------------------------------------------------
// Bedrock: runtime classifier for a block typeId. Fragments are matched on
// the id with its namespace stripped, so custom-namespace blocks (like this
// pack's own infinite_rail:support) can never be misread as vegetation.
// ---------------------------------------------------------------------------
const BEDROCK_EXACT = new Set();
const BEDROCK_FRAGMENTS = [];
for (const c of CATEGORIES) {
  for (const id of c.bedrockIds) BEDROCK_EXACT.add(id);
  for (const f of c.bedrockFragments) BEDROCK_FRAGMENTS.push(f);
}

export function isVegetation(typeId) {
  if (typeof typeId !== 'string' || !typeId.startsWith('minecraft:')) return false;
  const name = typeId.slice('minecraft:'.length);
  if (BEDROCK_EXACT.has(name)) return true;
  for (const f of BEDROCK_FRAGMENTS) {
    if (name.includes(f)) return true;
  }
  return false;
}
