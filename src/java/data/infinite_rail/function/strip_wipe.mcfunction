# Macro helper for strip_col_clear: take the just-in-time rail off one
# invisible column again (rail first, then its support -- the reverse of
# strip_set's order, so the rail never sits unsupported mid-wipe). The rare
# column whose support cell held terrain before the strip covered it is
# left as air -- a one-block pothole ~2 blocks under the glide line, a few
# hundred blocks behind the rider (the same cell visible track permanently
# replaces with its disguised redstone block).
$setblock $(x) $(ry) $(z) minecraft:air
$setblock $(x) $(sy) $(z) minecraft:air
