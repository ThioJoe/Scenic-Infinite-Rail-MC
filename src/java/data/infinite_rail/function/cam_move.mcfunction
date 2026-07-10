# Teleports the camera seat (and with it the whole rigid rig: ride cart +
# rider) to (.PACE_CART_BEHIND - .RIDER_BEHIND) blocks east of the pace cart
# -- i.e. .RIDER_BEHIND blocks behind the build head -- at the smoothed
# height. The seat lands so that the ride cart rests on the smoothed rail
# line like a real cart would (~1/16 block above it), plus .CAMHEIGHT extra.
#
# X/Z never touch a scoreboard: the tp runs AT the pace cart and moves east by
# the relative rig lead, keeping full double precision however far the ride
# goes. tp needs literal/relative coordinates, so the offsets go through the
# cam_tp macro.
scoreboard players operation .t2 ir = .CAMHEIGHT cfg_camera
scoreboard players operation .t2 ir *= .C100 ir
scoreboard players operation .t2 ir += .sy ir
scoreboard players add .t2 ir 62
execute store result storage infinite_rail:cam y double 0.001 run scoreboard players get .t2 ir
scoreboard players operation .cadx ir = .PACE_CART_BEHIND cfg_ride
scoreboard players operation .cadx ir -= .RIDER_BEHIND cfg_camera
execute store result storage infinite_rail:cam dx int 1 run scoreboard players get .cadx ir
execute at @e[type=minecart,tag=ir_cart,limit=1] run function infinite_rail:cam_tp with storage infinite_rail:cam
