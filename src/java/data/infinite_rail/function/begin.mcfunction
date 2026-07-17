# Starts the ride: phase 1 of the launch. Runs as/at the starting player,
# aligned to the block grid. Seeds the world, the anchor, the first column
# and the pace cart, then hands off to launch_tick (via .started 2), which
# pre-builds the runway across several ticks and finishes the launch in
# launch_done (the rig + the one player mount). See the handoff comment at
# the bottom for why the launch is phased.

# --- Reset any previous run ---
# First, while the previous ride's state is still intact: take back any
# just-in-time strip rails invisible-track mode left under its pace cart
# (stop does the same; this covers a begin without a stop).
function infinite_rail:strip_stop
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
# version (format 92+ gets the overlay). Health-checked: the file ends with
# `return 1`, so success 0 here means it did not run AT ALL (failed to
# compile on this version -- one bad gamerule name kills the whole file --
# or the version fell outside the overlay range). That failure is otherwise
# perfectly silent, and it costs every protection at once: phantoms,
# creeper/enderman griefing, fire, fall damage...
scoreboard players set .swok ir 0
execute store success score .swok ir run function infinite_rail:setup_world
execute if score .swok ir matches 0 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Warning: the world-tuning gamerules could not be applied (setup_world failed to load on this Minecraft version). Phantoms, mob griefing, fire and damage protection are NOT active. Please report this with your exact game version.","color":"yellow"}]

# Java has no recipe-unlocking gamerule (Bedrock's setup_world uses one), so
# pre-unlock EVERY recipe instead: with nothing left to unlock, no "recipes
# unlocked" toast can ever pop mid-ride. Costs one combined toast here at
# start, before the launch.
recipe give @s *

# Apply the land cruising speed (.speed -- the config default .DEFAULTSPEED
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

# --- Anchor the line at the player's position, snapped to Z ≡ 14 (mod 16) ---
# The snap is chunk math: with the centerline at row offset 14, the rail
# strip (z-1..z+1, offsets 13..15) fits in ONE chunk row -- the whole
# non-torch forceload corridor is a single row -- and the ±.TORCHRANGE (30)
# torch band spans exactly four rows. The line lands at most 14 blocks from
# where the starter stood; the lift-onto-the-line tp below follows the head.
summon minecraft:marker ~0.5 0.0 ~0.5 {Tags:["ir_head"]}
summon minecraft:marker ~0.5 0.0 ~0.5 {Tags:["ir_probe"]}
execute store result score .cz ir run data get entity @e[type=marker,tag=ir_head,limit=1] Pos[2]
scoreboard players operation .czd ir = .cz ir
scoreboard players operation .czd ir %= .C16 ir
scoreboard players set .czt ir 14
scoreboard players operation .czt ir -= .czd ir
execute store result storage infinite_rail:anchor dz int 1 run scoreboard players get .czt ir
function infinite_rail:anchor_z with storage infinite_rail:anchor
# Remember the snapped centerline (block Z) as state: the pace watchdog's
# recovery teleport needs an absolute Z that doesn't depend on any entity
# still being loaded (the head can be in unloaded chunks in exactly the
# situations that strand the cart).
scoreboard players operation .lineZ ir = .cz ir
scoreboard players operation .lineZ ir += .czt ir
execute at @e[type=marker,tag=ir_head,limit=1] run forceload add ~-16 ~-1 ~ ~1
execute at @e[type=marker,tag=ir_head,limit=1] run function infinite_rail:forceload_here

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
# Start flat, with a large flat-gap so the first climb/descent is unrestricted
# (and no leftover big-event gap credit from a previous ride: .evrun 0).
scoreboard players set .slope ir 0
scoreboard players set .flat ir 99
scoreboard players set .lastDir ir 0
scoreboard players set .evrun ir 0
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
# No phased roll cycle mid-flight from a previous ride (roll_phase would
# otherwise run its remaining slices at the new head -- harmless adds, but
# a stale .flok warning could fire before the first real roll).
scoreboard players set .rollP ir 0

# --- Surface cache: forget everything (surf_roll rebuilds it at the new
# anchor on the first column; its entries then fill lazily, one probe per
# never-read X -- see surf_roll) ---
data modify storage infinite_rail:surf c set value []
scoreboard players reset .surfBase ir

# --- Track history: one rail-Y int per column, for the camera path ---
data modify storage infinite_rail:track y set value []
scoreboard players operation .trackBase ir = .headX ir
data modify storage infinite_rail:track y append value 0
execute store result storage infinite_rail:track y[-1] int 1 run scoreboard players get .railY ir
# ...and the per-column visibility list beside it (invisible track, §6.9):
# fresh, same anchor, first entry per the current .HIDETRACK. The strip
# keeper's state resets with it (.stpAny arms it only once an invisible
# column exists; the placed-range pointers re-seed on first use).
data modify storage infinite_rail:track v set value []
scoreboard players operation .stpBase ir = .headX ir
execute unless score .HIDETRACK ir matches 1 run data modify storage infinite_rail:track v append value 1
execute if score .HIDETRACK ir matches 1 run data modify storage infinite_rail:track v append value 0
scoreboard players set .stpAny ir 0
execute if score .HIDETRACK ir matches 1 run scoreboard players set .stpAny ir 1
scoreboard players reset .stpLo ir
scoreboard players reset .stpHi ir
scoreboard players reset .stpAt ir
scoreboard players set .stpT ir 0

# --- First column and the hidden pace cart (plugged so nothing can enter) ---
# The anchor IS the starting player's position, so the first column is about
# to be built exactly where they stand -- and with the default .HOVER (2) the
# SOLID support block lands at their head height: a few ticks of suffocation
# damage (and the player-hurt sound) before launch_done can mount them. Lift
# the player onto the line first -- standing in the rail's own cell, the
# support solidifies under their feet instead of inside their skull, and the
# carve keeps the bore above them clear. launch_done summons the rig at the
# rider and seats them a few ticks later; the pace cart summoned below simply
# rolls out from underneath them in the meantime.
execute at @e[type=marker,tag=ir_head,limit=1] run tp @s ~ ~ ~
execute at @e[type=marker,tag=ir_head,limit=1] run function infinite_rail:place_flat
execute at @e[type=marker,tag=ir_head,limit=1] run summon minecraft:minecart ~ ~0.1 ~ {Tags:["ir_cart"],Invulnerable:1b,Motion:[0.4,0.0,0.0]}
execute at @e[type=marker,tag=ir_head,limit=1] run summon minecraft:item_display ~ ~1 ~ {Tags:["ir_plug"]}
ride @e[type=item_display,tag=ir_plug,limit=1] mount @e[type=minecart,tag=ir_cart,limit=1]

# --- Seed the ocean speed-up state ---
execute store result score .cartX ir run data get entity @e[type=minecart,tag=ir_cart,limit=1] Pos[0] 1
# The rider starts (.PACE_CART_BEHIND - .RIDER_BEHIND) blocks ahead of the
# pace cart, so seed .lastChunk from that chunk (matches where ocean_check
# samples). Empty ocean/land run counters.
scoreboard players operation .lastChunk ir = .cartX ir
scoreboard players operation .lastChunk ir += .PACE_CART_BEHIND cfg_ride
scoreboard players operation .lastChunk ir -= .RIDER_BEHIND cfg_camera
scoreboard players operation .lastChunk ir /= .C16 ir
scoreboard players set .oceanRun ir 0
scoreboard players set .landRun ir 0

# --- Seed the pace-cart watchdog (pace_watch, run from main every 60
# ticks): baseline X = the cart just summoned, clean interval clock and
# counters. .wdfixn is the lifetime recovery count -- the test suites
# assert it stays 0 on a healthy ride, so it must reset per ride.
scoreboard players operation .wdX ir = .cartX ir
scoreboard players operation .wdX ir *= .C10 ir
scoreboard players set .wdt ir 0
scoreboard players set .wdstuck ir 0
scoreboard players set .wdmiss ir 0
scoreboard players set .wdfixn ir 0

# --- Invisible track: if the mode is already on, the first column above was
# built WITHOUT its rail -- run the strip keeper once, right now, so the
# just-summoned pace cart has a rail under it before its first physics tick.
function infinite_rail:invis_tick

# --- Hand the rest of the launch to the ticker (launch_tick/launch_done) ---
# The runway pre-build (out to the rig position + 32 columns) plus the rig
# used to run right here, synchronously -- but one command chain that big brushes vanilla's
# per-chain command/fork budgets, and a chain that exceeds a budget is cut
# off SILENTLY. That manifested as: track built, pace cart rolling away, rig
# never summoned, rider never mounted, .started never set. So begin now only
# marks the launch: .started 2 makes tick run launch_tick, which extends the
# runway a couple dozen columns per tick (every tick is its own fresh chain,
# so no budget can ever be hit) and then finishes the launch in launch_done.
# The rider is remembered by tag -- begin's player context is gone by then.
tag @s add ir_rider
scoreboard players operation .pregoal ir = .headX ir
scoreboard players operation .pregoal ir += .PACE_CART_BEHIND cfg_ride
scoreboard players operation .pregoal ir -= .RIDER_BEHIND cfg_camera
scoreboard players add .pregoal ir 32
scoreboard players set .started ir 2
