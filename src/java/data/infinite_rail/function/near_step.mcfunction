# One probe of the near-ground scan (see near_scan): snaps the probe marker
# onto the surface at the current position (same heightmap trick as
# sample_window -- ignores leaves, counts water surfaces), folds the read
# into .gfloor (max, while the offset is within .DOWNLOOK) and .gmax (max,
# within .UPLOOK), then hops 2 blocks east and recurses while .nk <= .nw.
# A void / ungenerated read (<= -63) is skipped entirely, leaving the
# -10000 fail-open sentinel untouched.
execute positioned over motion_blocking_no_leaves run tp @e[type=marker,tag=ir_probe,limit=1] ~ ~ ~
execute store result score .s ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
execute if score .s ir matches -62.. if score .nk ir <= .DOWNLOOK ir run scoreboard players operation .gfloor ir > .s ir
execute if score .s ir matches -62.. if score .nk ir <= .UPLOOK ir run scoreboard players operation .gmax ir > .s ir
scoreboard players add .nk ir 2
execute if score .nk ir <= .nw ir positioned ~2 ~ ~ run function infinite_rail:near_step
