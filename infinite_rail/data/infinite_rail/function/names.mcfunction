# Version-specific command / gamerule NAMES, kept in one place so the shared
# logic files never hard-code a name that differs between Minecraft versions.
#
# This is the BASE (camelCase / pre-25w44a) copy, used on data-pack formats
# 82-91. On format 92+ (26.x, which renamed gamerules to snake_case) the
# `overlay_snake` overlay replaces this whole file with its snake_case twin --
# see pack.mcmeta. `load` calls this once; anything version-dependent that is a
# pure rename lives here as a variable.
#
# Currently just the minecart max-speed gamerule (read by set_speed as
# storage infinite_rail:speed rule). Add more entries here as needed.
data modify storage infinite_rail:speed rule set value "minecartMaxSpeed"
