# One sample of the window walk (see sample_window): probe the surface at
# the current position (probe_surface -- heightmap + the not-terrain
# dig-down), discard a void/ungenerated read (<= Y-63, falls back to the
# rolling average), clamp to at most .DOWNCLAMP below the previous average
# (no upward clamp -- mountains register at full height), accumulate into
# .sum, and hop another .SAMPLE_BLOCK_INTERVAL east while fewer than .winn
# samples have been taken.
function infinite_rail:probe_surface
execute store result score .s ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
execute if score .s ir matches ..-63 run scoreboard players operation .s ir = .avg ir
execute if score .s ir < .lo ir run scoreboard players operation .s ir = .lo ir
scoreboard players operation .sum ir += .s ir
scoreboard players add .wk ir 1
execute if score .wk ir < .winn ir run function infinite_rail:sample_hop with storage infinite_rail:samp
