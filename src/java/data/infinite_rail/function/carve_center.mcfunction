# (a function macro) Clears the center bore above the critical envelope in
# one fill -- used for full-clear columns (.veg 0: slopes and the .SLOPECLEAR
# buffer around them). fill needs literal coordinates, so the height arrives
# as a macro arg (storage infinite_rail:carve h, set by the place_* caller to
# .TUNNELCLEAR or .TUNNELUP). Runs positioned at the head (the rail cell).
$fill ~ ~2 ~ ~ ~$(h) ~ minecraft:air
