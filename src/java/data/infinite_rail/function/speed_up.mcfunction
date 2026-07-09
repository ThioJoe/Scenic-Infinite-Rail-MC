# Apply the OCEAN cruise speed (.ocnspd -- adjustable state, default the
# config .OCEANSPEED; the Speed -/+/Reset items tune it while the sprint is
# on, in BOTH directions -- the old max(.OCEANSPEED, .speed) "the ocean never
# slows the ride" rule is retired in its favor). Called by ocean_check on
# EVERY ocean chunk past the threshold, so the ocean cruise is re-applied and
# always sticks -- self-healing any manual /gamerule change or desynced state.
# (A mid-sprint Speed click applies instantly through speed_apply anyway;
# this re-assert is the safety net.)
# The debug message and the .fast flag flip happen only on the first call
# (while .fast is still 0), so there's no spam while cruising.
execute store result storage infinite_rail:speed v int 1 run scoreboard players get .ocnspd ir
function infinite_rail:set_speed with storage infinite_rail:speed
execute if score .DEBUGMODE ir matches 1 if score .fast ir matches 0 run tellraw @a [{"text":"[SR Debug] ","color":"dark_aqua"},{"text":"switching to fast ocean mode, speed ","color":"aqua"},{"score":{"name":".ocnspd","objective":"ir"},"color":"white"}]
scoreboard players set .fast ir 1
