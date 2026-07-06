# Mode toggle:  /function infinite_rail:mode_rain_on
# Permanent rain: freezes the vanilla weather cycle (so the rain can never
# time out) and starts it raining. World state, not ride state -- it works
# with or without a ride running, sticks across /reload and rejoins, and
# stacks with the other modes (rain + night is the storm ride).
# The weather-cycle gamerule's NAME is version-dependent (doWeatherCycle /
# advance_weather), so it comes from names.mcfunction via the set_rule macro
# rather than being hard-coded here.
scoreboard players set .RAINMODE ir 1
data modify storage infinite_rail:rule rule set from storage infinite_rail:names weather_cycle
data modify storage infinite_rail:rule v set value "false"
function infinite_rail:set_rule with storage infinite_rail:rule
weather rain
tellraw @a [{"text":"[Infinite Rail] ","color":"gold"},{"text":"Rain mode ON - permanent rain.","color":"gray"}]
