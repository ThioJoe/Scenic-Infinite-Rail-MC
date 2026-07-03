# Starts the ride. Runs as/at the starting player, aligned to the block grid.

# --- Reset any previous run ---
scoreboard players set #started ir 0
kill @e[type=marker,tag=ir_head]
kill @e[type=marker,tag=ir_probe]
kill @e[type=minecart,tag=ir_cart]
forceload remove all
ride @s dismount

# --- World tuning ---
function infinite_rail:setup_world

# --- Anchor the line at the player's position ---
summon minecraft:marker ~0.5 0.0 ~0.5 {Tags:["ir_head"]}
summon minecraft:marker ~0.5 0.0 ~0.5 {Tags:["ir_probe"]}
forceload add ~-16 ~-8 ~191 ~8

# --- Initial rail elevation = terrain surface here + hover altitude ---
execute positioned over motion_blocking_no_leaves run tp @e[type=marker,tag=ir_probe,limit=1] ~ ~ ~
execute store result score #railY ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
scoreboard players operation #railY ir += #HOVER ir
execute store result storage infinite_rail:tmp y double 1 run scoreboard players get #railY ir
data modify entity @e[type=marker,tag=ir_head,limit=1] Pos[1] set from storage infinite_rail:tmp y

# --- Initialize counters ---
execute store result score #headX ir run data get entity @e[type=marker,tag=ir_head,limit=1] Pos[0] 1
scoreboard players set #since ir 99
# Seed the rolling average (used as the fallback for bad heightmap samples).
scoreboard players operation #avg ir = #railY ir
scoreboard players operation #avg ir -= #HOVER ir
scoreboard players operation #nextLoad ir = #headX ir
scoreboard players add #nextLoad ir 16

# --- First column, cart, and rider ---
execute at @e[type=marker,tag=ir_head,limit=1] run function infinite_rail:place_flat
execute at @e[type=marker,tag=ir_head,limit=1] run summon minecraft:minecart ~ ~0.1 ~ {Tags:["ir_cart"],Invulnerable:1b,Motion:[0.4,0.0,0.0]}
ride @s mount @e[type=minecart,tag=ir_cart,limit=1]
gamemode adventure @s
effect give @s minecraft:resistance infinite 255 true
effect give @s minecraft:saturation infinite 0 true

# --- Pre-build the first stretch synchronously, then hand off to the ticker ---
execute store result score #cartX ir run data get entity @e[type=minecart,tag=ir_cart,limit=1] Pos[0] 1
scoreboard players set #budget ir 32
function infinite_rail:build_loop
scoreboard players set #started ir 1
tellraw @a [{"text":"[Infinite Rail] ","color":"gold"},{"text":"Enjoy the ride.","color":"gray"}]
