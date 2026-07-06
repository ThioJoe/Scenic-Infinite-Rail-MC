# Time mode:  /function infinite_rail:mode_day_on
# DAY ONLY: freezes the daylight cycle and sets the time to noon, so the sun
# hangs still at its highest -- endless daylight for the scenery. One of the
# tri-state time options (.NIGHTMODE: 0 = default cycle, 1 = night only,
# 2 = day only). World state like the other modes. (See mode_night_on for
# how the version-dependent gamerule name is handled.)
scoreboard players set .NIGHTMODE ir 2
data modify storage infinite_rail:rule rule set from storage infinite_rail:names daylight_cycle
data modify storage infinite_rail:rule v set value "false"
function infinite_rail:set_rule with storage infinite_rail:rule
time set noon
tellraw @a [{"text":"[Infinite Rail] ","color":"gold"},{"text":"Time: day only - frozen at noon.","color":"gray"}]
