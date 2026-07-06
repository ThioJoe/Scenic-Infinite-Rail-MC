# Samples the terrain surface heightmap at 12 points, +4..+48 blocks east of
# the head, into .sum. Must run positioned at the head marker.
# motion_blocking_no_leaves: ignores tree canopy, includes water/lava surfaces
# (so oceans read as sea level and get bridged).
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
execute positioned ~4 ~ ~ positioned over motion_blocking_no_leaves run tp @e[type=marker,tag=ir_probe,limit=1] ~ ~ ~
execute store result score .s ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
execute if score .s ir matches ..-63 run scoreboard players operation .s ir = .avg ir
execute if score .s ir < .lo ir run scoreboard players operation .s ir = .lo ir
execute if score .s ir > .hi ir run scoreboard players operation .s ir = .hi ir
scoreboard players operation .sum ir += .s ir
execute positioned ~8 ~ ~ positioned over motion_blocking_no_leaves run tp @e[type=marker,tag=ir_probe,limit=1] ~ ~ ~
execute store result score .s ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
execute if score .s ir matches ..-63 run scoreboard players operation .s ir = .avg ir
execute if score .s ir < .lo ir run scoreboard players operation .s ir = .lo ir
execute if score .s ir > .hi ir run scoreboard players operation .s ir = .hi ir
scoreboard players operation .sum ir += .s ir
execute positioned ~12 ~ ~ positioned over motion_blocking_no_leaves run tp @e[type=marker,tag=ir_probe,limit=1] ~ ~ ~
execute store result score .s ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
execute if score .s ir matches ..-63 run scoreboard players operation .s ir = .avg ir
execute if score .s ir < .lo ir run scoreboard players operation .s ir = .lo ir
execute if score .s ir > .hi ir run scoreboard players operation .s ir = .hi ir
scoreboard players operation .sum ir += .s ir
execute positioned ~16 ~ ~ positioned over motion_blocking_no_leaves run tp @e[type=marker,tag=ir_probe,limit=1] ~ ~ ~
execute store result score .s ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
execute if score .s ir matches ..-63 run scoreboard players operation .s ir = .avg ir
execute if score .s ir < .lo ir run scoreboard players operation .s ir = .lo ir
execute if score .s ir > .hi ir run scoreboard players operation .s ir = .hi ir
scoreboard players operation .sum ir += .s ir
execute positioned ~20 ~ ~ positioned over motion_blocking_no_leaves run tp @e[type=marker,tag=ir_probe,limit=1] ~ ~ ~
execute store result score .s ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
execute if score .s ir matches ..-63 run scoreboard players operation .s ir = .avg ir
execute if score .s ir < .lo ir run scoreboard players operation .s ir = .lo ir
execute if score .s ir > .hi ir run scoreboard players operation .s ir = .hi ir
scoreboard players operation .sum ir += .s ir
execute positioned ~24 ~ ~ positioned over motion_blocking_no_leaves run tp @e[type=marker,tag=ir_probe,limit=1] ~ ~ ~
execute store result score .s ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
execute if score .s ir matches ..-63 run scoreboard players operation .s ir = .avg ir
execute if score .s ir < .lo ir run scoreboard players operation .s ir = .lo ir
execute if score .s ir > .hi ir run scoreboard players operation .s ir = .hi ir
scoreboard players operation .sum ir += .s ir
execute positioned ~28 ~ ~ positioned over motion_blocking_no_leaves run tp @e[type=marker,tag=ir_probe,limit=1] ~ ~ ~
execute store result score .s ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
execute if score .s ir matches ..-63 run scoreboard players operation .s ir = .avg ir
execute if score .s ir < .lo ir run scoreboard players operation .s ir = .lo ir
execute if score .s ir > .hi ir run scoreboard players operation .s ir = .hi ir
scoreboard players operation .sum ir += .s ir
execute positioned ~32 ~ ~ positioned over motion_blocking_no_leaves run tp @e[type=marker,tag=ir_probe,limit=1] ~ ~ ~
execute store result score .s ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
execute if score .s ir matches ..-63 run scoreboard players operation .s ir = .avg ir
execute if score .s ir < .lo ir run scoreboard players operation .s ir = .lo ir
execute if score .s ir > .hi ir run scoreboard players operation .s ir = .hi ir
scoreboard players operation .sum ir += .s ir
execute positioned ~36 ~ ~ positioned over motion_blocking_no_leaves run tp @e[type=marker,tag=ir_probe,limit=1] ~ ~ ~
execute store result score .s ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
execute if score .s ir matches ..-63 run scoreboard players operation .s ir = .avg ir
execute if score .s ir < .lo ir run scoreboard players operation .s ir = .lo ir
execute if score .s ir > .hi ir run scoreboard players operation .s ir = .hi ir
scoreboard players operation .sum ir += .s ir
execute positioned ~40 ~ ~ positioned over motion_blocking_no_leaves run tp @e[type=marker,tag=ir_probe,limit=1] ~ ~ ~
execute store result score .s ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
execute if score .s ir matches ..-63 run scoreboard players operation .s ir = .avg ir
execute if score .s ir < .lo ir run scoreboard players operation .s ir = .lo ir
execute if score .s ir > .hi ir run scoreboard players operation .s ir = .hi ir
scoreboard players operation .sum ir += .s ir
execute positioned ~44 ~ ~ positioned over motion_blocking_no_leaves run tp @e[type=marker,tag=ir_probe,limit=1] ~ ~ ~
execute store result score .s ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
execute if score .s ir matches ..-63 run scoreboard players operation .s ir = .avg ir
execute if score .s ir < .lo ir run scoreboard players operation .s ir = .lo ir
execute if score .s ir > .hi ir run scoreboard players operation .s ir = .hi ir
scoreboard players operation .sum ir += .s ir
execute positioned ~48 ~ ~ positioned over motion_blocking_no_leaves run tp @e[type=marker,tag=ir_probe,limit=1] ~ ~ ~
execute store result score .s ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
execute if score .s ir matches ..-63 run scoreboard players operation .s ir = .avg ir
execute if score .s ir < .lo ir run scoreboard players operation .s ir = .lo ir
execute if score .s ir > .hi ir run scoreboard players operation .s ir = .hi ir
scoreboard players operation .sum ir += .s ir
