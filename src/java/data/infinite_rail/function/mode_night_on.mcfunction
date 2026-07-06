# Time mode:  /function infinite_rail:mode_night_on
# NIGHT ONLY: freezes the daylight cycle and sets the time to midnight, so
# the moon hangs still at its highest. One of the tri-state time options
# (.NIGHTMODE: 0 = default cycle, 1 = night only, 2 = day only -- see
# mode_day_on / mode_night_off). World state, not ride state -- it sticks
# across /reload and rejoins and stacks with the other modes (combine with
# mode_torches_on for a lantern-lit night ride).
# The daylight-cycle gamerule's NAME is version-dependent (doDaylightCycle /
# advance_time), so it comes from names.mcfunction via the set_rule macro.
scoreboard players set .NIGHTMODE ir 1
data modify storage infinite_rail:rule rule set from storage infinite_rail:names daylight_cycle
data modify storage infinite_rail:rule v set value "false"
function infinite_rail:set_rule with storage infinite_rail:rule
time set midnight
tellraw @a [{"text":"[Infinite Rail] ","color":"gold"},{"text":"Time: night only - frozen at midnight.","color":"gray"}]
