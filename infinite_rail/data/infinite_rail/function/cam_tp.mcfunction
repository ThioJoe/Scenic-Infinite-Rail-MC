# Macro helper for cam_follow: teleports the camera seat to the computed
# position. tp only accepts literal/relative coordinates (not scoreboard
# values), so the smoothed position arrives as macro arguments.
$tp @e[type=item_display,tag=ir_seat,limit=1] $(x) $(y) $(z)
