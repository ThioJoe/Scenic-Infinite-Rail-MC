# Runs on datapack (re)load and on world load. Sets up the scoreboard, then
# applies the tunable settings from config.mcfunction (edit THAT file to change
# defaults). Nothing user-facing lives here.
scoreboard objectives add ir dummy
# The tunable settings live in three sidebar-sized objectives -- cfg_terrain
# (terrain following / slope shaping), cfg_camera (the ride rig) and cfg_ride
# (speed, mode knobs, performance) -- grouped so the Debug book can put any
# one of them on the scoreboard sidebar: a vanilla sidebar shows at most 15
# rows and only ONE objective at a time, and there are 30+ knobs. Runtime
# state, the mode toggles and the two knobs that aren't worth a sidebar row
# (.DEBUGMODE, .AUTOSTART) stay in the classic `ir` objective.
scoreboard objectives add cfg_terrain dummy "Terrain settings"
scoreboard objectives add cfg_camera dummy "Camera settings"
scoreboard objectives add cfg_ride dummy "Ride settings"
# The Debug book's "Live state" sidebar view: a curated <=15-row mirror of
# the most useful runtime scores, refreshed every tick by debug_tick while
# that view is selected (.SIDEBAR 4). Real state stays in `ir`; this
# objective exists only to be displayed.
scoreboard objectives add dbg dummy "Live state"
# The menu books' (Ride/Visual Settings, Debug) click channel: a trigger-criteria objective that
# players may set with /trigger at permission level 0 -- which is what lets
# the books' links work without operator AND without 1.21.6+'s "elevated
# permissions" confirmation screen popping on every click. menu_tick
# dispatches the values (see give_menu / menu_tick).
scoreboard objectives add ir_menu trigger
# The Speed +/- hotbar items' click channel: both items are re-modeled
# carrot_on_a_sticks, so a right-click bumps this stat objective and
# menu_tick hands it to speed_click (which tells them apart by custom_data).
scoreboard objectives add ir_click minecraft.used:minecraft.carrot_on_a_stick

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

# Cross-edition internal constants (the shared consts.mcfunction -- the
# Bedrock script runs the same file from its init): .SPEEDSTEP & co.
function infinite_rail:consts

# Apply all tunable settings.
function infinite_rail:config

# Seed the ride-mode toggle scores (0 = off) if they've never been set. Modes
# are state, not config: config re-runs on every /reload, so keeping them out
# of it is what lets an enabled mode survive a reload (see modes_init).
function infinite_rail:modes_init

# Derived from the tunables above: slope columns carve one block taller than
# flat ones for extra headroom as the cart rises/falls. Recomputed here so it
# tracks .TUNNEL on every /reload.
scoreboard players operation .TUNNELUP ir = .TUNNEL cfg_terrain
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

# Silence command feedback ON LOAD, not just at ride start (setup_world sets
# it too, but only when a ride begins). Without this, every menu-book click
# echoes the vanilla /trigger feedback ("Triggered [ir_menu] (set value to
# N)") into chat whenever the world has the rule on -- the player only ever
# wants the pack's own [Scenic Rail] replies. Version-dependent name
# (send_command_feedback on 26.x), so it goes through names/set_rule like
# the chain budgets above.
data modify storage infinite_rail:rule rule set from storage infinite_rail:names cmd_feedback
data modify storage infinite_rail:rule v set value "false"
function infinite_rail:set_rule with storage infinite_rail:rule

# Self-test the day/night check (time_now.mcfunction reads the
# #infinite_rail:night predicate -- §6.7). The `execute if predicate`
# probes live in the QUARANTINED check_clock.mcfunction, NOT here: 26.2
# refused to compile that command inside this file, and a single
# non-compiling line kills its whole file at load -- in THIS file that
# meant no objectives, no config, no auto-start, a completely dead pack.
# This file must only ever contain bulletproof commands (scoreboard /
# function / data / tellraw / execute-if-score); anything riskier goes in
# its own small file, where a failure costs one soft function call.
# .todok stays 0 either when both predicates read false or when
# check_clock itself failed to load -- both mean the same thing: torch
# auto cannot tell day from night on this version (time_now runs the same
# command), so warn loudly. The pack boots fine either way.
scoreboard players set .todok ir 0
function infinite_rail:check_clock
execute if score .todok ir matches 0 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Warning: the day/night check is not working on this Minecraft version, so torch mode's Auto (night-only) setting cannot tell day from night and will not plant torches. Always-on torch mode still works. Please report this with your exact game version.","color":"yellow"}]

tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Loaded. A fresh world starts the ride automatically; run ","color":"gray"},{"text":"/function infinite_rail:start","color":"aqua"},{"text":" to (re)start it here.","color":"gray"}]
