# Version-specific command / gamerule NAMES, kept in one place so the shared
# logic files never hard-code a name that differs between Minecraft versions.
#
# This is the BASE (camelCase / pre-25w44a) copy, used on data-pack formats
# 82-91. On format 92+ (26.x, which renamed gamerules to snake_case) the
# `overlay_snake` overlay replaces this whole file with its snake_case twin --
# see pack.mcmeta. `load` calls this once; anything version-dependent that is a
# pure rename lives here as a variable.
#
# Entries: the minecart max-speed gamerule (read by set_speed as storage
# infinite_rail:speed rule), the weather-cycle / daylight-cycle gamerules
# (storage infinite_rail:names, copied into the set_rule macro by the rain and
# night mode toggles), and the command chain/fork budget gamerules (raised by
# load -- the synchronous ride start builds ~a hundred columns in one chain).
# Add more entries here as needed.
data modify storage infinite_rail:speed rule set value "minecartMaxSpeed"
data modify storage infinite_rail:names weather_cycle set value "doWeatherCycle"
data modify storage infinite_rail:names daylight_cycle set value "doDaylightCycle"
data modify storage infinite_rail:names chain_length set value "maxCommandChainLength"
data modify storage infinite_rail:names fork_count set value "maxCommandForkCount"
