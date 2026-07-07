# Runs every game tick via #minecraft:tick.
# The menu books' (Ride/Visual Settings, Debug) click dispatcher (the /trigger relay -- see
# menu_tick), which also fans out the Speed items' ir_click stat.
function infinite_rail:menu_tick
# The Debug book's "Live state" sidebar: refresh the dbg mirror while that
# view is selected (.SIDEBAR 4 -- see sidebar_state / debug_tick).
execute if score .SIDEBAR ir matches 4 run function infinite_rail:debug_tick
execute if score .started ir matches 1 run function infinite_rail:main
# .started 2 = a launch is in progress: begin seeded the ride and the runway
# is being pre-built a slice per tick (see launch_tick / launch_done).
execute if score .started ir matches 2 run function infinite_rail:launch_tick

# Auto-start: in a fresh world, begin the ride for the first player to appear
# -- no command needed.
# .autodone is set the first time a ride starts and is
# saved with the world, so /function infinite_rail:stop stays stopped (across
# rejoins too).
# Set .AUTOSTART to 0 in config.mcfunction to disable.

# Wait until a player actually exists in the world, then count up 100 ticks (5 seconds) to let chunks load.
execute if score .AUTOSTART ir matches 1 unless score .autodone ir matches 1 if entity @a run scoreboard players add .start_timer ir 1
execute if score .start_timer ir matches 1 unless score .autodone ir matches 1 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Starting in 5...","color":"yellow"}]
execute if score .start_timer ir matches 20 unless score .autodone ir matches 1 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Starting in 4...","color":"yellow"}]
execute if score .start_timer ir matches 40 unless score .autodone ir matches 1 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Starting in 3...","color":"yellow"}]
execute if score .start_timer ir matches 60 unless score .autodone ir matches 1 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Starting in 2...","color":"yellow"}]
execute if score .start_timer ir matches 80 unless score .autodone ir matches 1 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Starting in 1...","color":"yellow"}]
execute if score .start_timer ir matches 100 unless score .autodone ir matches 1 run function infinite_rail:start