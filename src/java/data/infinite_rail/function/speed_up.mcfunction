# Enforce the ocean cruising speed -- which may only ever SPEED the ride UP:
# the applied speed is max(.OCEANSPEED, .speed), so a land speed raised past
# the ocean speed with the Speed + item is kept over the water too (the
# ocean never slows the cart down). Called by ocean_check on EVERY ocean
# chunk past the threshold, so the winning speed is re-applied and always
# wins -- self-healing any manual /gamerule change or desynced state, and a
# .speed change made mid-sprint takes effect at the next ocean chunk.
# The debug message and the .fast flag flip happen only on the first call (while
# .fast is still 0), so there's no spam while cruising.
scoreboard players operation .ospd ir = .OCEANSPEED cfg_ride
scoreboard players operation .ospd ir > .speed ir
execute store result storage infinite_rail:speed v int 1 run scoreboard players get .ospd ir
function infinite_rail:set_speed with storage infinite_rail:speed
execute if score .DEBUGMODE ir matches 1 if score .fast ir matches 0 run tellraw @a [{"text":"[SR Debug] ","color":"dark_aqua"},{"text":"switching to fast ocean mode, speed ","color":"aqua"},{"score":{"name":".ospd","objective":"ir"},"color":"white"}]
scoreboard players set .fast ir 1
