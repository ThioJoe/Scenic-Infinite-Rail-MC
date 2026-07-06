# Time mode:  /function infinite_rail:mode_night_off
# Back to DEFAULT time: sets the clock to morning and resumes the normal
# day/night cycle. Ends either frozen time option (night only / day only --
# .NIGHTMODE back to 0); mode_day_off is an alias for this. (See
# mode_night_on for how the version-dependent gamerule name is handled.)
scoreboard players set .NIGHTMODE ir 0
data modify storage infinite_rail:rule rule set from storage infinite_rail:names daylight_cycle
data modify storage infinite_rail:rule v set value "true"
function infinite_rail:set_rule with storage infinite_rail:rule
time set day
tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Time: default - normal day/night cycle restored.","color":"gray"}]
