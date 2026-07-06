# Mode toggle:  /function infinite_rail:mode_rain_off
# Back to default weather: the vanilla weather cycle resumes and the current
# rain is cleared. (See mode_rain_on for how the version-dependent gamerule
# name is handled.)
scoreboard players set .RAINMODE ir 0
data modify storage infinite_rail:rule rule set from storage infinite_rail:names weather_cycle
data modify storage infinite_rail:rule v set value "true"
function infinite_rail:set_rule with storage infinite_rail:rule
weather clear
tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Rain mode OFF - normal weather restored.","color":"gray"}]
