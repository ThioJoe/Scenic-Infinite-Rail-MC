# Mode toggle:  /function infinite_rail:mode_night_on
# Endless night: freezes the daylight cycle and sets the time to midnight,
# so the moon hangs still at its highest. World state, not ride state -- it
# sticks across /reload and rejoins and stacks with the other modes (combine
# with mode_torches_on for a lantern-lit night ride).
# The daylight-cycle gamerule's NAME is version-dependent (doDaylightCycle /
# advance_time), so it comes from names.mcfunction via the set_rule macro.
scoreboard players set #NIGHTMODE ir 1
data modify storage infinite_rail:rule rule set from storage infinite_rail:names daylight_cycle
data modify storage infinite_rail:rule v set value "false"
function infinite_rail:set_rule with storage infinite_rail:rule
time set midnight
tellraw @a [{"text":"[Infinite Rail] ","color":"gold"},{"text":"Night mode ON - frozen at midnight. ","color":"gray"},{"text":"/function infinite_rail:mode_night_off","color":"aqua"},{"text":" restores daytime.","color":"gray"}]
