# Mode toggle:  /function infinite_rail:mode_aggro_off
# Mobs ignore the ride: an infinite hidden invisibility effect on the rider
# shrinks every mob's sight range to a few percent (on Bedrock it blinds
# them entirely), so the ride glides through the night unbothered -- no
# bow-draws, no hisses, no chases. The scenery mobs still spawn and wander;
# they just pay the rider no attention. Side effects: the rider's own body
# is hidden in third-person/F5 (the cart still shows), and on Bedrock the
# first-person arm disappears too (the invisibility effect is the retired
# .HIDEHAND knob's old mechanism). launch_done re-applies this at ride
# start; stop clears it with the rider's other effects.
scoreboard players set .AGGROMODE ir 0
effect give @a[tag=ir_rider] minecraft:invisibility infinite 0 true
tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Mobs aggro OFF - mobs will ignore the ride.","color":"gray"}]
