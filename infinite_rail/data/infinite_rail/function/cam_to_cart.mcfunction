# The track is flat again and the glide has settled back to parity: hand the
# rider back to the real cart for native riding feel, and swap the plug onto
# the seat. Heights match by calibration, so nothing visibly moves.
ride @e[type=item_display,tag=ir_plug,limit=1] dismount
ride @a[gamemode=adventure,limit=1] dismount
ride @a[gamemode=adventure,limit=1] mount @e[type=minecart,tag=ir_cart,limit=1]
ride @e[type=item_display,tag=ir_plug,limit=1] mount @e[type=item_display,tag=ir_seat,limit=1]
scoreboard players set #onSeat ir 0
