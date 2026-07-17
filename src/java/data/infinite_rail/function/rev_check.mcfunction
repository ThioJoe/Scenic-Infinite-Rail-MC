# The reverse end-stop (stop-and-reverse, §6.10), run from main every tick
# while the signed target .curtgt is negative: a ride running backwards
# stops when the pace cart -- the westernmost piece, so it arrives first --
# reaches the START (west end) of the remembered track. Beyond .trackBase
# there is no history for the camera to fly or the watchdog to verify (and
# on a ride longer than the ~2048-column history bound, no memory of the
# track at all), so the ride parks just inside it: the ACTIVE cruise is
# zeroed (whichever one is currently negative -- the same context pick as
# speed_step), the gamerule follows, and the cart's motion is cut. Speed +
# (or Reset) heads east again from here.
# No selectable pace cart: don't trust .cartX -- a store whose command fails
# writes 0 on modern versions, and on a ride at positive coordinates that
# garbage 0 could read as "west of the start" and park the ride spuriously.
# The watchdog owns the missing-cart case; this check just waits.
execute unless entity @e[type=minecart,tag=ir_cart,limit=1] run return 0
scoreboard players operation .rvs ir = .trackBase ir
scoreboard players add .rvs ir 2
execute if score .cartX ir > .rvs ir run return 0
# Park: zero the active cruise; .curtgt follows so this can't re-fire.
execute if score .SKYMODE ir matches 1 run scoreboard players set .skyspd ir 0
execute unless score .SKYMODE ir matches 1 if score .fast ir matches 1 run scoreboard players set .ocnspd ir 0
execute unless score .SKYMODE ir matches 1 unless score .fast ir matches 1 run scoreboard players set .speed ir 0
scoreboard players set .curtgt ir 0
scoreboard players set .spush ir 0
function infinite_rail:speed_push
data merge entity @e[type=minecart,tag=ir_cart,limit=1] {Motion:[0.0d,0.0d,0.0d]}
tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Reached the start of the track - ride stopped. Use Speed + to head east again.","color":"gray"}]
