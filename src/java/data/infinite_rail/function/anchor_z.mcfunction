# Macro helper for begin: shift both anchor markers onto the snapped
# centerline (Z ≡ 14 mod 16) by $(dz) blocks -- the chunk-tightest anchor
# for the forceload corridor (see begin's snap comment). NBT teleports need
# a literal offset, so it arrives as a macro argument.
$execute as @e[type=marker,tag=ir_head,limit=1] at @s run tp @s ~ ~ ~$(dz)
$execute as @e[type=marker,tag=ir_probe,limit=1] at @s run tp @s ~ ~ ~$(dz)
