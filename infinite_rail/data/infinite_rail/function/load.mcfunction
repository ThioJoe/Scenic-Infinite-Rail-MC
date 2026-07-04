# Runs on datapack (re)load and on world load. Sets up the scoreboard, then
# applies the tunable settings from config.mcfunction (edit THAT file to change
# defaults). Nothing user-facing lives here.
scoreboard objectives add ir dummy

# Internal constant: number of heightmap samples averaged per column. This is
# fixed by the sample count in sample_window.mcfunction -- do not change it
# here on its own, so it stays out of the user config.
scoreboard players set #C12 ir 12

# Internal constants: fixed-point multipliers for the smooth-camera math
# (#CAMHEIGHT is configured in tenths of a block; the seat height #sy is
# tracked in milliblocks).
scoreboard players set #C100 ir 100
scoreboard players set #C1000 ir 1000

# Apply all tunable settings.
function infinite_rail:config

tellraw @a [{"text":"[Infinite Rail] ","color":"gold"},{"text":"Loaded. A fresh world starts the ride automatically; run ","color":"gray"},{"text":"/function infinite_rail:start","color":"aqua"},{"text":" to (re)start it here.","color":"gray"}]
