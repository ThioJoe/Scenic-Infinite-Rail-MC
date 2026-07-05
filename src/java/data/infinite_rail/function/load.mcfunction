# Runs on datapack (re)load and on world load. Sets up the scoreboard, then
# applies the tunable settings from config.mcfunction (edit THAT file to change
# defaults). Nothing user-facing lives here.
scoreboard objectives add ir dummy
# The Settings book's click channel: a trigger-criteria objective that
# players may set with /trigger at permission level 0 -- which is what lets
# the book's links work without operator AND without 1.21.6+'s "elevated
# permissions" confirmation screen popping on every click. menu_tick
# dispatches the values (see give_menu / menu_tick).
scoreboard objectives add ir_menu trigger

# Internal constant: number of heightmap samples averaged per column. This is
# fixed by the sample count in sample_window.mcfunction -- do not change it
# here on its own, so it stays out of the user config.
scoreboard players set .C12 ir 12

# Internal constants for the camera math: fixed-point multipliers
# (.CAMHEIGHT/.CAMLIFT are configured in tenths of a block; heights are
# tracked in milliblocks) and small divisors for the scan geometry.
scoreboard players set .C2 ir 2
scoreboard players set .C10 ir 10
scoreboard players set .C100 ir 100
scoreboard players set .C1000 ir 1000
# Blocks per chunk -- the divisor for the ocean-biome chunk counter.
scoreboard players set .C16 ir 16

# Apply all tunable settings.
function infinite_rail:config

# Seed the ride-mode toggle scores (0 = off) if they've never been set. Modes
# are state, not config: config re-runs on every /reload, so keeping them out
# of it is what lets an enabled mode survive a reload (see modes_init).
function infinite_rail:modes_init

# Derived from the tunables above: slope columns carve one block taller than
# flat ones for extra headroom as the cart rises/falls. Recomputed here so it
# tracks .TUNNEL on every /reload.
scoreboard players operation .TUNNELUP ir = .TUNNEL ir
scoreboard players add .TUNNELUP ir 1

# Load the version-specific command/gamerule names (e.g. the minecart max-speed
# gamerule name into storage infinite_rail:speed rule). The base names.mcfunction
# holds the camelCase names; on data-pack format 92+ the `overlay_snake` overlay
# replaces it with the snake_case names (see pack.mcmeta and names.mcfunction).
function infinite_rail:names

# Raise the per-chain command budgets (belt and suspenders). Vanilla caps
# one command chain -- a function call and EVERYTHING nested under it -- at
# 65536 commands / 65536 execution forks, and a chain that exceeds a budget
# is TRUNCATED SILENTLY, which is undebuggable in the field. The launch no
# longer depends on this (it is phased across ticks -- launch_tick), but
# heavy config values (.MAXTICK, .UPLOOK) deserve headroom. Names are
# version-dependent (snake_case on 26.x), so they come from names.mcfunction
# via set_rule.
data modify storage infinite_rail:rule rule set from storage infinite_rail:names chain_length
data modify storage infinite_rail:rule v set value "1000000"
function infinite_rail:set_rule with storage infinite_rail:rule
data modify storage infinite_rail:rule rule set from storage infinite_rail:names fork_count
data modify storage infinite_rail:rule v set value "1000000"
function infinite_rail:set_rule with storage infinite_rail:rule

tellraw @a [{"text":"[Infinite Rail] ","color":"gold"},{"text":"Loaded. A fresh world starts the ride automatically; run ","color":"gray"},{"text":"/function infinite_rail:start","color":"aqua"},{"text":" to (re)start it here.","color":"gray"}]
