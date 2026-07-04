# Per-tick smooth-camera driver. The rider does not sit in the physical
# minecart: they ride an invisible item_display ("the camera seat", ir_seat),
# so the cart's rail physics never reach their eyes. Each tick this function
# teleports the seat to the cart's exact X/Z -- the real cart therefore always
# sets the pace, however fast the rails push it -- at a vertically SMOOTHED
# height:
#
#     seatY += (cartY + #CAMHEIGHT - seatY) / #CAMSMOOTH
#
# an exponential glide that turns the cart's stair-step bounce and hard
# flat->45->flat corners into one eased swoop. On top of that the seat's
# teleport_duration makes the client interpolate every teleport over a few
# frames, so motion is smooth frame-by-frame, not just tick-by-tick.
#
# The seat height is tracked in milliblocks (Y x 1000) in #sy for sub-block
# precision. X/Z are copied straight from the cart's NBT as doubles -- never
# through a scoreboard -- so there is no precision loss or integer overflow
# no matter how far east the ride gets. Must be gated on ir_cart existing.

# X/Z follow the cart exactly.
data modify storage infinite_rail:cam x set from entity @e[type=minecart,tag=ir_cart,limit=1] Pos[0]
data modify storage infinite_rail:cam z set from entity @e[type=minecart,tag=ir_cart,limit=1] Pos[2]

# Target height (milliblocks) = cart Y + #CAMHEIGHT (config, tenths of a block).
execute store result score #cy ir run data get entity @e[type=minecart,tag=ir_cart,limit=1] Pos[1] 1000
scoreboard players operation #ty ir = #CAMHEIGHT ir
scoreboard players operation #ty ir *= #C100 ir
scoreboard players operation #ty ir += #cy ir

# Exponential glide: close 1/#CAMSMOOTH of the remaining vertical gap.
scoreboard players operation #dy ir = #ty ir
scoreboard players operation #dy ir -= #sy ir
scoreboard players operation #dy ir /= #CAMSMOOTH ir
scoreboard players operation #sy ir += #dy ir

# Teleport the seat (tp needs literal coordinates, so hand them to a macro).
execute store result storage infinite_rail:cam y double 0.001 run scoreboard players get #sy ir
function infinite_rail:cam_tp with storage infinite_rail:cam
