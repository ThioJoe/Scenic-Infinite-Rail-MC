# Samples the terrain surface at 12 points, +4..+48 blocks east of the
# head, into .sum. Must run positioned at the head marker.
# Each sample runs probe_surface: the motion_blocking_no_leaves heightmap
# (ignores tree canopy, includes water/lava surfaces so oceans read as sea
# level) plus the dig-down through #infinite_rail:not_terrain (tree trunks,
# village houses... -- see probe_surface), so only real ground and liquid
# surfaces count as terrain.
#
# Each sample is clamped to [-.DOWNCLAMP, +.UPCLAMP] around the previous
# window average: narrow ravines/holes barely move the target (they get
# bridged level, per the "ignore the sudden dip" rule) while approaching
# mountains still raise it early for a "one swoop" climb. A reading at or
# below Y-63 (void / ungenerated chunk) is discarded entirely.
scoreboard players operation .lo ir = .avg ir
scoreboard players operation .lo ir -= .DOWNCLAMP cfg_terrain
scoreboard players operation .hi ir = .avg ir
scoreboard players operation .hi ir += .UPCLAMP cfg_terrain
execute positioned ~4 ~ ~ run function infinite_rail:probe_surface
execute store result score .s ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
execute if score .s ir matches ..-63 run scoreboard players operation .s ir = .avg ir
execute if score .s ir < .lo ir run scoreboard players operation .s ir = .lo ir
execute if score .s ir > .hi ir run scoreboard players operation .s ir = .hi ir
scoreboard players operation .sum ir += .s ir
execute positioned ~8 ~ ~ run function infinite_rail:probe_surface
execute store result score .s ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
execute if score .s ir matches ..-63 run scoreboard players operation .s ir = .avg ir
execute if score .s ir < .lo ir run scoreboard players operation .s ir = .lo ir
execute if score .s ir > .hi ir run scoreboard players operation .s ir = .hi ir
scoreboard players operation .sum ir += .s ir
execute positioned ~12 ~ ~ run function infinite_rail:probe_surface
execute store result score .s ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
execute if score .s ir matches ..-63 run scoreboard players operation .s ir = .avg ir
execute if score .s ir < .lo ir run scoreboard players operation .s ir = .lo ir
execute if score .s ir > .hi ir run scoreboard players operation .s ir = .hi ir
scoreboard players operation .sum ir += .s ir
execute positioned ~16 ~ ~ run function infinite_rail:probe_surface
execute store result score .s ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
execute if score .s ir matches ..-63 run scoreboard players operation .s ir = .avg ir
execute if score .s ir < .lo ir run scoreboard players operation .s ir = .lo ir
execute if score .s ir > .hi ir run scoreboard players operation .s ir = .hi ir
scoreboard players operation .sum ir += .s ir
execute positioned ~20 ~ ~ run function infinite_rail:probe_surface
execute store result score .s ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
execute if score .s ir matches ..-63 run scoreboard players operation .s ir = .avg ir
execute if score .s ir < .lo ir run scoreboard players operation .s ir = .lo ir
execute if score .s ir > .hi ir run scoreboard players operation .s ir = .hi ir
scoreboard players operation .sum ir += .s ir
execute positioned ~24 ~ ~ run function infinite_rail:probe_surface
execute store result score .s ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
execute if score .s ir matches ..-63 run scoreboard players operation .s ir = .avg ir
execute if score .s ir < .lo ir run scoreboard players operation .s ir = .lo ir
execute if score .s ir > .hi ir run scoreboard players operation .s ir = .hi ir
scoreboard players operation .sum ir += .s ir
execute positioned ~28 ~ ~ run function infinite_rail:probe_surface
execute store result score .s ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
execute if score .s ir matches ..-63 run scoreboard players operation .s ir = .avg ir
execute if score .s ir < .lo ir run scoreboard players operation .s ir = .lo ir
execute if score .s ir > .hi ir run scoreboard players operation .s ir = .hi ir
scoreboard players operation .sum ir += .s ir
execute positioned ~32 ~ ~ run function infinite_rail:probe_surface
execute store result score .s ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
execute if score .s ir matches ..-63 run scoreboard players operation .s ir = .avg ir
execute if score .s ir < .lo ir run scoreboard players operation .s ir = .lo ir
execute if score .s ir > .hi ir run scoreboard players operation .s ir = .hi ir
scoreboard players operation .sum ir += .s ir
execute positioned ~36 ~ ~ run function infinite_rail:probe_surface
execute store result score .s ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
execute if score .s ir matches ..-63 run scoreboard players operation .s ir = .avg ir
execute if score .s ir < .lo ir run scoreboard players operation .s ir = .lo ir
execute if score .s ir > .hi ir run scoreboard players operation .s ir = .hi ir
scoreboard players operation .sum ir += .s ir
execute positioned ~40 ~ ~ run function infinite_rail:probe_surface
execute store result score .s ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
execute if score .s ir matches ..-63 run scoreboard players operation .s ir = .avg ir
execute if score .s ir < .lo ir run scoreboard players operation .s ir = .lo ir
execute if score .s ir > .hi ir run scoreboard players operation .s ir = .hi ir
scoreboard players operation .sum ir += .s ir
execute positioned ~44 ~ ~ run function infinite_rail:probe_surface
execute store result score .s ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
execute if score .s ir matches ..-63 run scoreboard players operation .s ir = .avg ir
execute if score .s ir < .lo ir run scoreboard players operation .s ir = .lo ir
execute if score .s ir > .hi ir run scoreboard players operation .s ir = .hi ir
scoreboard players operation .sum ir += .s ir
execute positioned ~48 ~ ~ run function infinite_rail:probe_surface
execute store result score .s ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
execute if score .s ir matches ..-63 run scoreboard players operation .s ir = .avg ir
execute if score .s ir < .lo ir run scoreboard players operation .s ir = .lo ir
execute if score .s ir > .hi ir run scoreboard players operation .s ir = .hi ir
scoreboard players operation .sum ir += .s ir
