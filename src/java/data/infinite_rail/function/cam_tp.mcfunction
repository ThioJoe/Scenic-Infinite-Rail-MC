# Macro helper for cam_move: teleports the camera seat #CAMAHEAD blocks east
# of the execution position (the pace cart) at the computed absolute height.
# Mixing relative X/Z with an absolute Y is valid, and keeps X/Z at full
# double precision without ever passing them through a scoreboard.
$tp @e[type=item_display,tag=ir_seat,limit=1] ~$(dx) $(y) ~
