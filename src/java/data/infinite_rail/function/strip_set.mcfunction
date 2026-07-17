# Macro helper for strip_col_place: lay the pace cart's just-in-time rail on
# one invisible column -- the SAME redstone-block + smooth-stone display +
# powered-rail the visible builder places (support.mcfunction), so the short
# strip trailing the pace cart reads as ordinary disguised track when glanced
# at from behind (over a big descent it used to show as raw red redstone up
# in the sky). Support first, rail second (a rail with nothing under it pops
# off). setblock only takes literal coordinates, so they arrive as macro args
# from storage infinite_rail:strip; a setblock onto an identical block fails
# silently, which is what makes re-placement free. The display is summoned
# ONLY if one isn't already in the cell (summon is not idempotent -- the
# distance guard makes the per-tick ensure-walk a no-op once it exists); it
# is tagged ir_strip (NOT ir_disp) so strip_wipe can remove only strip
# displays and never the permanent ones on adjacent visible track.
$setblock $(x) $(sy) $(z) minecraft:redstone_block
$execute unless entity @e[type=block_display,tag=ir_strip,x=$(x),y=$(sy),z=$(z),distance=..0.9] run summon minecraft:block_display $(x) $(sy) $(z) {Tags:["ir_strip"],block_state:{Name:"minecraft:smooth_stone"},brightness:{sky:15,block:15},transformation:{translation:[0f,-0.005f,-0.005f],scale:[1f,1.01f,1.01f],left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f]}}
$setblock $(x) $(ry) $(z) minecraft:powered_rail[shape=$(shape),powered=true]
