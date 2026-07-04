# Starts the ride. Runs as/at the starting player, aligned to the block grid.

# --- Reset any previous run ---
scoreboard players set #started ir 0
# A ride has now been started in this world: the auto-starter must never fire again.
scoreboard players set #autodone ir 1
kill @e[type=marker,tag=ir_head]
kill @e[type=marker,tag=ir_probe]
kill @e[type=minecart,tag=ir_cart]
kill @e[type=minecart,tag=ir_ride]
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

# Apply the configured default minecart max-speed gamerule once, at the start.
# (Not enforced afterwards -- change /gamerule yourself mid-ride if you want.)
scoreboard players set #fast ir 0
execute store result storage infinite_rail:speed v int 1 run scoreboard players get #MAXSPEED ir
function infinite_rail:set_speed with storage infinite_rail:speed
execute if score #DEBUGMODE ir matches 1 run tellraw @a [{"text":"[IR debug] ","color":"dark_aqua"},{"text":"default minecart speed set to ","color":"gray"},{"score":{"name":"#MAXSPEED","objective":"ir"},"color":"white"},{"text":" (needs Minecart Improvements enabled to take effect)","color":"dark_gray"}]

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

# --- First column and the hidden pace cart (plugged so nothing can enter) ---
execute at @e[type=marker,tag=ir_head,limit=1] run function infinite_rail:place_flat
execute at @e[type=marker,tag=ir_head,limit=1] run summon minecraft:minecart ~ ~0.1 ~ {Tags:["ir_cart"],Invulnerable:1b,Motion:[0.4,0.0,0.0]}
execute at @e[type=marker,tag=ir_head,limit=1] run summon minecraft:item_display ~ ~1 ~ {Tags:["ir_plug"]}
ride @e[type=item_display,tag=ir_plug,limit=1] mount @e[type=minecart,tag=ir_cart,limit=1]

# --- Pre-build past the rig position so the viewer starts on ready track ---
execute store result score #cartX ir run data get entity @e[type=minecart,tag=ir_cart,limit=1] Pos[0] 1
# Seed the ocean speed-up state: the rider starts #CAMAHEAD blocks ahead of the
# pace cart, so seed #lastChunk from that chunk (matches where ocean_check
# samples). Empty ocean/land run counters.
scoreboard players operation #lastChunk ir = #cartX ir
scoreboard players operation #lastChunk ir += #CAMAHEAD ir
scoreboard players operation #lastChunk ir /= #C16 ir
scoreboard players set #oceanRun ir 0
scoreboard players set #landRun ir 0
scoreboard players operation #budget ir = #CAMAHEAD ir
scoreboard players add #budget ir 32
function infinite_rail:build_loop

# --- The camera rig: seat (interpolated mover) + ride cart + rider ---
# The rider mounts ONCE, here, and is never remounted during the ride (mount
# events flash the vanilla "press X to dismount" hint, which can't be hidden).
# The ride cart is a real minecart riding the seat, off the rails: the whole
# stack moves rigidly with the seat's client-side interpolation, so the cart
# can never bounce, tilt or shift against the rider's view.
# teleport_duration:1 keeps the seat's interpolation in the same class as
# normal entity movement so the world glides by smoothly.
execute at @e[type=marker,tag=ir_head,limit=1] run summon minecraft:item_display ~ ~1 ~ {Tags:["ir_seat"],teleport_duration:1}
execute at @e[type=marker,tag=ir_head,limit=1] run summon minecraft:minecart ~ ~1 ~ {Tags:["ir_ride"],Invulnerable:1b,Rotation:[90f,0f]}
ride @e[type=minecart,tag=ir_ride,limit=1] mount @e[type=item_display,tag=ir_seat,limit=1]
ride @s mount @e[type=minecart,tag=ir_ride,limit=1]
gamemode adventure @s
effect give @s minecraft:resistance infinite 255 true
effect give @s minecraft:saturation infinite 0 true
# The rider is visible again (they sit in a real cart) -- clear any leftover
# invisibility from rides started on older pack versions.
effect clear @s minecraft:invisibility
# Bedrock only: hide the rider's hand/held item (no-op on Java -- see hide_hand).
function infinite_rail:hide_hand

# --- Snap the rig to its cruising position and hand off to the ticker ---
# The S-curve (c1) is stateless; only the descent chaser (#s2) needs seeding.
scoreboard players operation #s2 ir = #railY ir
scoreboard players operation #s2 ir *= #C1000 ir
function infinite_rail:cam_follow
scoreboard players set #started ir 1
tellraw @a [{"text":"[Infinite Rail] ","color":"gold"},{"text":"Enjoy the ride.","color":"gray"}]
