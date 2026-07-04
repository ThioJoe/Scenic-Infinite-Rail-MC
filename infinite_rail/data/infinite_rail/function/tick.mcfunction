# Runs every game tick via #minecraft:tick.
execute if score #started ir matches 1 run function infinite_rail:main

# Auto-start: in a fresh world, begin the ride for the first player to appear
# -- no command needed.
#autodone is set the first time a ride starts and is
# saved with the world, so /function infinite_rail:stop stays stopped (across
# rejoins too).
# Set #AUTOSTART to 0 in config.mcfunction to disable.

# Wait until a player actually exists in the world, then count up 60 ticks (3 seconds) to let chunks load.
execute if score #AUTOSTART ir matches 1 unless score #autodone ir matches 1 if entity @a run scoreboard players add #start_timer ir 1
execute if score #start_timer ir matches 30 unless score #autodone ir matches 1 run function infinite_rail:start