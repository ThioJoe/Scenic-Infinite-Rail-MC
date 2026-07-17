# Macro helper for strip_col_place: lay the pace cart's just-in-time rail on
# one invisible column -- the same redstone-block + powered-rail pair the
# visible builder places (minus the smooth-stone disguise display: nobody
# ever sees this support). Support first, rail second (a rail with nothing
# under it pops off). setblock only takes literal coordinates, so they
# arrive as macro args from storage infinite_rail:strip; a setblock onto an
# identical block fails silently, which is what makes re-placement free.
$setblock $(x) $(sy) $(z) minecraft:redstone_block
$setblock $(x) $(ry) $(z) minecraft:powered_rail[shape=$(shape),powered=true]
