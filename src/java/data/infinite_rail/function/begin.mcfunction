# Starts the ride: phase 1 of the launch. Runs as/at the starting player,
# aligned to the block grid. Seeds the world, the anchor, the first column
# and the pace cart, then hands off to launch_tick (via .started 2), which
# pre-builds the runway across several ticks and finishes the launch in
# launch_done (the rig + the one player mount). See the handoff comment at
# the bottom for why the launch is phased.

# --- Reset any previous run ---
scoreboard players set .started ir 0
# A ride has now been started in this world: the auto-starter must never fire again.
scoreboard players set .autodone ir 1
kill @e[type=marker,tag=ir_head]
kill @e[type=marker,tag=ir_probe]
kill @e[type=minecart,tag=ir_cart]
kill @e[type=minecart,tag=ir_ride]
kill @e[type=item_display,tag=ir_seat]
kill @e[type=item_display,tag=ir_plug]
forceload remove all
ride @s dismount
tag @a remove ir_rider

# --- World tuning ---
# setup_world exists in two copies -- a base (camelCase) one and a snake_case
# one in the overlay_snake overlay -- and pack.mcmeta selects the right copy by
# version (format 92+ gets the overlay). Just call it once.
function infinite_rail:setup_world

# Java has no recipe-unlocking gamerule (Bedrock's setup_world uses one), so
# pre-unlock EVERY recipe instead: with nothing left to unlock, no "recipes
# unlocked" toast can ever pop mid-ride. Costs one combined toast here at
# start, before the launch.
recipe give @s *

# Apply the land cruising speed (.speed -- the config default .MAXSPEED
# unless adjusted with the Speed +/- items; state, so a chosen speed sticks
# across ride restarts) to the minecart max-speed gamerule once, at the
# start. (Not enforced afterwards -- change /gamerule yourself mid-ride if
# you want.)
scoreboard players set .fast ir 0
execute store result storage infinite_rail:speed v int 1 run scoreboard players get .speed ir
function infinite_rail:set_speed with storage infinite_rail:speed
execute if score .DEBUGMODE ir matches 1 run tellraw @a [{"text":"[SR Debug] ","color":"dark_aqua"},{"text":"ride speed set to ","color":"gray"},{"score":{"name":".speed","objective":"ir"},"color":"white"},{"text":" (needs Minecart Improvements enabled to take effect)","color":"dark_gray"}]
# Sky mode, if it was left on, overrides the default with its cruise speed.
execute if score .SKYMODE ir matches 1 run function infinite_rail:sky_speed

# --- Anchor the line at the player's position ---
summon minecraft:marker ~0.5 0.0 ~0.5 {Tags:["ir_head"]}
summon minecraft:marker ~0.5 0.0 ~0.5 {Tags:["ir_probe"]}
forceload add ~-16 ~-8 ~ ~8
function infinite_rail:forceload_here

# --- Initial rail elevation = terrain surface here + hover altitude ---
# probe_surface = heightmap snap + the not-terrain dig-down, so starting the
# ride while standing on a roof or under a tree still anchors to the ground.
function infinite_rail:probe_surface
execute store result score .railY ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
scoreboard players operation .railY ir += .HOVER cfg_terrain
execute store result storage infinite_rail:tmp y double 1 run scoreboard players get .railY ir
data modify entity @e[type=marker,tag=ir_head,limit=1] Pos[1] set from storage infinite_rail:tmp y

# --- Initialize counters and slope state ---
execute store result score .headX ir run data get entity @e[type=marker,tag=ir_head,limit=1] Pos[0] 1
# Start flat, with a large flat-gap so the first climb/descent is unrestricted.
scoreboard players set .slope ir 0
scoreboard players set .flat ir 99
scoreboard players set .lastDir ir 0
# Fresh carve-mode state (see decide): no slope buffer, no pending retro-clear.
# .veg 0 = the first column below (placed before any decide runs) gets a full
# clear; every later column's decide computes its own .veg.
scoreboard players set .vclear ir 0
scoreboard players set .retro ir 0
scoreboard players set .veg ir 0
# Seed the rolling average (used as the fallback for bad heightmap samples).
scoreboard players operation .avg ir = .railY ir
scoreboard players operation .avg ir -= .HOVER cfg_terrain
scoreboard players operation .nextLoad ir = .headX ir
scoreboard players add .nextLoad ir 16

# --- Track history: one rail-Y int per column, for the camera path ---
data modify storage infinite_rail:track y set value []
scoreboard players operation .trackBase ir = .headX ir
data modify storage infinite_rail:track y append value 0
execute store result storage infinite_rail:track y[-1] int 1 run scoreboard players get .railY ir

# --- First column and the hidden pace cart (plugged so nothing can enter) ---
execute at @e[type=marker,tag=ir_head,limit=1] run function infinite_rail:place_flat
execute at @e[type=marker,tag=ir_head,limit=1] run summon minecraft:minecart ~ ~0.1 ~ {Tags:["ir_cart"],Invulnerable:1b,Motion:[0.4,0.0,0.0]}
execute at @e[type=marker,tag=ir_head,limit=1] run summon minecraft:item_display ~ ~1 ~ {Tags:["ir_plug"]}
ride @e[type=item_display,tag=ir_plug,limit=1] mount @e[type=minecart,tag=ir_cart,limit=1]

# --- Seed the ocean speed-up state ---
execute store result score .cartX ir run data get entity @e[type=minecart,tag=ir_cart,limit=1] Pos[0] 1
# The rider starts .CAMAHEAD blocks ahead of the pace cart, so seed
# .lastChunk from that chunk (matches where ocean_check samples). Empty
# ocean/land run counters.
scoreboard players operation .lastChunk ir = .cartX ir
scoreboard players operation .lastChunk ir += .CAMAHEAD cfg_camera
scoreboard players operation .lastChunk ir /= .C16 ir
scoreboard players set .oceanRun ir 0
scoreboard players set .landRun ir 0

# --- Hand the rest of the launch to the ticker (launch_tick/launch_done) ---
# The runway pre-build (~.CAMAHEAD+32 columns) plus the rig used to run right
# here, synchronously -- but one command chain that big brushes vanilla's
# per-chain command/fork budgets, and a chain that exceeds a budget is cut
# off SILENTLY. That manifested as: track built, pace cart rolling away, rig
# never summoned, rider never mounted, .started never set. So begin now only
# marks the launch: .started 2 makes tick run launch_tick, which extends the
# runway a couple dozen columns per tick (every tick is its own fresh chain,
# so no budget can ever be hit) and then finishes the launch in launch_done.
# The rider is remembered by tag -- begin's player context is gone by then.
tag @s add ir_rider
scoreboard players operation .pregoal ir = .headX ir
scoreboard players operation .pregoal ir += .CAMAHEAD cfg_camera
scoreboard players add .pregoal ir 32
scoreboard players set .started ir 2
