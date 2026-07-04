# A slope is coming up (or the glide is unsettled): move the rider from the
# real cart onto the camera seat, and the plug the other way so the cart is
# never left empty (an empty cart scoops up passing mobs and can be entered
# by right-click). The seat is teleported to the rider's exact current height
# first (#sy is parked at calibrated parity while in cart mode), so the
# hand-over does not move the camera at all.
ride @e[type=item_display,tag=ir_plug,limit=1] dismount
ride @a[gamemode=adventure,limit=1] dismount
function infinite_rail:cam_move
ride @a[gamemode=adventure,limit=1] mount @e[type=item_display,tag=ir_seat,limit=1]
ride @e[type=item_display,tag=ir_plug,limit=1] mount @e[type=minecart,tag=ir_cart,limit=1]
scoreboard players set #onSeat ir 1
