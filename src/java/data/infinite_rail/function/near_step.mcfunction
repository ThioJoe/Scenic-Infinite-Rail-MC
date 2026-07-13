# One read of the near-ground scan (see near_scan): pop the cached surface
# at offset .nk off the scratch walk (two removes = the walk advances 2
# blocks east, so the reads land at odd offsets), lazily probing a slot
# nobody ever read (surf_prep -- once, cached for every later column). Then
# pair the read with the previous one (.pmin = min of the two, which erases
# 1-2 block wide spikes of real terrain) and fold the pair into .gfloor
# (within .DOWNLOOK_AHEAD only) / .gmax / .gcone (the climb side takes the
# whole walk); recurse while .nk <= .nw.
# The pair's distance is its NEAR end (.nk - 2, via .prj). A void /
# ungenerated read (<= -63) breaks the pair chain and is skipped entirely;
# .gnu counts valid reads so near_scan can fail the schedule open when
# there were none.
execute store result score .s ir run data get storage infinite_rail:surf w[0]
data remove storage infinite_rail:surf w[0]
data remove storage infinite_rail:surf w[0]
execute if score .s ir matches -32768 run scoreboard players operation .suo ir = .nk ir
execute if score .s ir matches -32768 run function infinite_rail:surf_prep
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
execute if score .nk ir <= .nw ir run function infinite_rail:near_step
