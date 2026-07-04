# Runs on datapack (re)load and on world load. Sets up the scoreboard, then
# applies the tunable settings from config.mcfunction (edit THAT file to change
# defaults). Nothing user-facing lives here.
scoreboard objectives add ir dummy

# Internal constant: number of heightmap samples averaged per column. This is
# fixed by the sample count in sample_window.mcfunction -- do not change it
# here on its own, so it stays out of the user config.
scoreboard players set #C12 ir 12

# Apply all tunable settings.
function infinite_rail:config

tellraw @a [{"text":"[Infinite Rail] ","color":"gold"},{"text":"Loaded. Run ","color":"gray"},{"text":"/function infinite_rail:start","color":"aqua"},{"text":" to begin the ride.","color":"gray"}]
