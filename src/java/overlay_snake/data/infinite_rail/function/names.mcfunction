# Version-specific command / gamerule NAMES -- 26.x snake_case copy.
#
# This overlay file (in overlay_snake/, applied on data-pack format 92+ via
# pack.mcmeta) REPLACES the base data/.../names.mcfunction on 26.x-era versions,
# where 25w44a renamed the gamerules to snake_case. Keep it in sync with the
# base copy: same variables, snake_case names.
data modify storage infinite_rail:speed rule set value "max_minecart_speed"
# 25w44a renamed doWeatherCycle -> advance_weather, doDaylightCycle -> advance_time.
data modify storage infinite_rail:names weather_cycle set value "advance_weather"
data modify storage infinite_rail:names daylight_cycle set value "advance_time"
data modify storage infinite_rail:names chain_length set value "max_command_chain_length"
data modify storage infinite_rail:names fork_count set value "max_command_fork_count"
data modify storage infinite_rail:names cmd_feedback set value "send_command_feedback"
