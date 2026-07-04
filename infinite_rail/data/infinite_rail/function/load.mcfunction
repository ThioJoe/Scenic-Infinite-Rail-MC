# Runs on datapack (re)load and on world load. Sets up the scoreboard, then
# applies the tunable settings from config.mcfunction (edit THAT file to change
# defaults). Nothing user-facing lives here.
scoreboard objectives add ir dummy

# Internal constant: number of heightmap samples averaged per column. This is
# fixed by the sample count in sample_window.mcfunction -- do not change it
# here on its own, so it stays out of the user config.
scoreboard players set #C12 ir 12

# Internal constants for the camera math: fixed-point multipliers
# (#CAMHEIGHT/#CAMLIFT are configured in tenths of a block; heights are
# tracked in milliblocks) and small divisors for the scan geometry.
scoreboard players set #C2 ir 2
scoreboard players set #C10 ir 10
scoreboard players set #C100 ir 100
scoreboard players set #C1000 ir 1000
# Blocks per chunk -- the divisor for the ocean-biome chunk counter.
scoreboard players set #C16 ir 16

# Apply all tunable settings.
function infinite_rail:config

# Derived from the tunables above: slope columns carve one block taller than
# flat ones for extra headroom as the cart rises/falls. Recomputed here so it
# tracks #TUNNEL on every /reload.
scoreboard players operation #TUNNELUP ir = #TUNNEL ir
scoreboard players add #TUNNELUP ir 1

# Detect the version-correct name of the minecart max-speed gamerule into
# storage infinite_rail:speed rule. Default to the 26.x snake_case name, then
# let the two detector functions override it: exactly one compiles per version
# (the other is dropped, like setup_world / setup_world_26). If the world has no
# Minecart Improvements feature, both are dropped and the default just no-ops.
data modify storage infinite_rail:speed rule set value "max_minecart_speed"
function infinite_rail:speed_name
function infinite_rail:speed_name_26

tellraw @a [{"text":"[Infinite Rail] ","color":"gold"},{"text":"Loaded. A fresh world starts the ride automatically; run ","color":"gray"},{"text":"/function infinite_rail:start","color":"aqua"},{"text":" to (re)start it here.","color":"gray"}]
