# Runs every game tick via #minecraft:tick.
execute if score #started ir matches 1 run function infinite_rail:main

# Auto-start: in a fresh world, begin the ride for the first player to appear
# -- no command needed. #autodone is set the first time a ride starts and is
# saved with the world, so /function infinite_rail:stop stays stopped (across
# rejoins too). Set #AUTOSTART to 0 in config.mcfunction to disable.
execute if score #AUTOSTART ir matches 1 if score #started ir matches 0 unless score #autodone ir matches 1 run function infinite_rail:start
