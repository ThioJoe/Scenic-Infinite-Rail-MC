# Macro helper for strip_col_clear: take the just-in-time rail off one
# invisible column again -- rail first, then the display, then the support
# cell (the reverse of strip_set's order, so the rail never sits unsupported
# mid-wipe). The support cell is repainted to the column's remembered surface
# material ($(surf) -- the same class carve restored at build, so an invisible
# plow reads as natural ground both while the strip covers it and after it
# passes, instead of the 1-wide dirt strip / air pothole a bare wipe left).
# $(surf) is minecraft:air for a hovering column (nothing was there) or a
# class the restore doesn't cover. The display kill targets only this cell's
# ir_strip display (distance guard), never a neighbor's or a permanent one.
$setblock $(x) $(ry) $(z) minecraft:air
$kill @e[type=block_display,tag=ir_strip,x=$(x),y=$(sy),z=$(z),distance=..0.9]
$setblock $(x) $(sy) $(z) $(surf)
