# Mode toggle:  /function infinite_rail:mode_night_off
# Back to default time: sets the clock to morning and resumes the daylight
# cycle. (See mode_night_on for how the version-dependent gamerule name is
# handled.)
scoreboard players set #NIGHTMODE ir 0
data modify storage infinite_rail:rule rule set from storage infinite_rail:names daylight_cycle
data modify storage infinite_rail:rule v set value "true"
function infinite_rail:set_rule with storage infinite_rail:rule
time set day
tellraw @a [{"text":"[Infinite Rail] ","color":"gold"},{"text":"Night mode OFF - daylight restored.","color":"gray"}]
