# Version-specific command / gamerule NAMES -- 26.x snake_case copy.
#
# This overlay file (in overlay_snake/, applied on data-pack format 92+ via
# pack.mcmeta) REPLACES the base data/.../names.mcfunction on 26.x-era versions,
# where 25w44a renamed the gamerules to snake_case. Keep it in sync with the
# base copy: same variables, snake_case names.
data modify storage infinite_rail:speed rule set value "max_minecart_speed"
