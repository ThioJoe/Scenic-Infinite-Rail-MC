# Encases the redstone torch so water and meltwater can never reach it.
# Must run positioned at the head marker; the torch is always two blocks below
# the rail (~-2). Its up/down neighbours are already the smooth-stone support
# and its west neighbour is the previous column's stack, so only three faces are
# exposed to the world:
#   ~ ~-2 ~-1 / ~ ~-2 ~1  -> the two flanks (perpendicular to travel)
#   ~1 ~-2 ~              -> the leading (east) face
# Barriers are invisible, indestructible, waterproof and emit no light, so they
# neither show, get washed away, nor melt ice. The east barrier guards the
# frontier-most torch while the builder is waiting for the cart to catch up; the
# next column simply overwrites it with its own support when building resumes.
setblock ~ ~-2 ~-1 minecraft:barrier
setblock ~ ~-2 ~1 minecraft:barrier
setblock ~1 ~-2 ~ minecraft:barrier
