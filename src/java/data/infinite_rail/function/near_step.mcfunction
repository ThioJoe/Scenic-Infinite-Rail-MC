# One probe of the near-ground scan (see near_scan): snaps the probe marker
# onto the surface at the current position (probe_surface -- the same
# heightmap + not-terrain dig-down as sample_window: ignores leaves, tree
# trunks and man-made structures, counts water surfaces), pairs the read
# with the previous probe (.pmin = min of the two, which erases 1-2 block
# wide spikes of real terrain), folds the pair into .gfloor (within
# .DOWNLOOK_AHEAD only) / .gmax / .gcone (the climb side takes the whole
# walk), then hops 2 blocks east and recurses while .nk <= .nw.
# The pair's distance is its NEAR end (.nk - 2, via .prj). A void /
# ungenerated read (<= -63) breaks the pair chain and is skipped entirely;
# .gnu counts valid probes so near_scan can fail the schedule open when
# there were none.
function infinite_rail:probe_surface
execute store result score .s ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
scoreboard players operation .pmin ir = .s ir
scoreboard players operation .pmin ir < .sprev ir
scoreboard players operation .prj ir = .pmin ir
scoreboard players operation .prj ir -= .nk ir
scoreboard players add .prj ir 2
execute if score .s ir matches -62.. if score .sprev ir matches -62.. if score .nk ir <= .DOWNLOOK_AHEAD cfg_terrain run scoreboard players operation .gfloor ir > .pmin ir
execute if score .s ir matches -62.. if score .sprev ir matches -62.. run scoreboard players operation .gmax ir > .pmin ir
execute if score .s ir matches -62.. if score .sprev ir matches -62.. if score .pmin ir > .gbase ir run scoreboard players operation .gcone ir > .prj ir
execute if score .s ir matches -62.. run scoreboard players add .gnu ir 1
execute if score .s ir matches -62.. run scoreboard players operation .sprev ir = .s ir
execute if score .s ir matches ..-63 run scoreboard players set .sprev ir -32000
scoreboard players add .nk ir 2
execute if score .nk ir <= .nw ir positioned ~2 ~ ~ run function infinite_rail:near_step
