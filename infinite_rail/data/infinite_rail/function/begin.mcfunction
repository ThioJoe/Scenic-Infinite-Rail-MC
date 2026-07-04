# Starts the ride. Runs as/at the starting player, aligned to the block grid.

# --- Reset any previous run ---
scoreboard players set #started ir 0
# A ride has now been started in this world: the auto-starter must never fire again.
scoreboard players set #autodone ir 1
kill @e[type=marker,tag=ir_head]
kill @e[type=marker,tag=ir_probe]
kill @e[type=minecart,tag=ir_cart]
kill @e[type=item_display,tag=ir_seat]
kill @e[type=item_display,tag=ir_plug]
forceload remove all
ride @s dismount

# --- World tuning ---
# Two variants: camelCase gamerules for 1.21-era, snake_case for 26.x-era
# (25w44a renamed them all). Only the variant that compiles on the running
# version exists in memory; calling the other is a harmless no-op.
function infinite_rail:setup_world
function infinite_rail:setup_world_26

# --- Anchor the line at the player's position ---
summon minecraft:marker ~0.5 0.0 ~0.5 {Tags:["ir_head"]}
summon minecraft:marker ~0.5 0.0 ~0.5 {Tags:["ir_probe"]}
forceload add ~-16 ~-8 ~ ~8
execute store result storage infinite_rail:args gen int 1 run scoreboard players get #GENAHEAD ir
function infinite_rail:forceload with storage infinite_rail:args

# --- Initial rail elevation = terrain surface here + hover altitude ---
execute positioned over motion_blocking_no_leaves run tp @e[type=marker,tag=ir_probe,limit=1] ~ ~ ~
execute store result score #railY ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
scoreboard players operation #railY ir += #HOVER ir
execute store result storage infinite_rail:tmp y double 1 run scoreboard players get #railY ir
data modify entity @e[type=marker,tag=ir_head,limit=1] Pos[1] set from storage infinite_rail:tmp y

# --- Initialize counters and slope state ---
execute store result score #headX ir run data get entity @e[type=marker,tag=ir_head,limit=1] Pos[0] 1
# Start flat, with a large flat-gap so the first climb/descent is unrestricted.
scoreboard players set #slope ir 0
scoreboard players set #flat ir 99
scoreboard players set #lastDir ir 0
# Seed the rolling average (used as the fallback for bad heightmap samples).
scoreboard players operation #avg ir = #railY ir
scoreboard players operation #avg ir -= #HOVER ir
scoreboard players operation #nextLoad ir = #headX ir
scoreboard players add #nextLoad ir 16

# --- Track history: one rail-Y int per column, for the camera path ---
data modify storage infinite_rail:track y set value []
scoreboard players operation #trackBase ir = #headX ir
data modify storage infinite_rail:track y append value 0
execute store result storage infinite_rail:track y[-1] int 1 run scoreboard players get #railY ir

# --- Camera rig: the seat (ridden around slopes) and the plug (occupies
# whichever of cart/seat the rider doesn't, so the cart is never empty) ---
# teleport_duration:1 = client interpolates each per-tick teleport over one
# tick, the same class of smoothing the cart itself gets, so the two stay in
# visual sync.
execute at @e[type=marker,tag=ir_head,limit=1] run summon minecraft:item_display ~ ~1 ~ {Tags:["ir_seat"],teleport_duration:1}
execute at @e[type=marker,tag=ir_head,limit=1] run summon minecraft:item_display ~ ~1 ~ {Tags:["ir_plug"]}
scoreboard players set #onSeat ir 0
scoreboard players set #sbOk ir 0
scoreboard players operation #sy ir = #railY ir
scoreboard players operation #sy ir *= #C1000 ir

# --- First column, cart, and rider ---
execute at @e[type=marker,tag=ir_head,limit=1] run function infinite_rail:place_flat
execute at @e[type=marker,tag=ir_head,limit=1] run summon minecraft:minecart ~ ~0.1 ~ {Tags:["ir_cart"],Invulnerable:1b,Motion:[0.4,0.0,0.0]}
# The rider starts in the REAL cart (flat track = native riding); cam_follow
# hands them to the camera seat around elevation changes. The plug takes the
# seat meanwhile.
ride @s mount @e[type=minecart,tag=ir_cart,limit=1]
ride @e[type=item_display,tag=ir_plug,limit=1] mount @e[type=item_display,tag=ir_seat,limit=1]
gamemode adventure @s
effect give @s minecraft:resistance infinite 255 true
effect give @s minecraft:saturation infinite 0 true
# Invisible, so the rider's body never photobombs the view while on the seat.
effect give @s minecraft:invisibility infinite 0 true

# --- Pre-build the first stretch synchronously, then hand off to the ticker ---
execute store result score #cartX ir run data get entity @e[type=minecart,tag=ir_cart,limit=1] Pos[0] 1
scoreboard players set #budget ir 32
function infinite_rail:build_loop
scoreboard players set #started ir 1
tellraw @a [{"text":"[Infinite Rail] ","color":"gold"},{"text":"Enjoy the ride.","color":"gray"}]
