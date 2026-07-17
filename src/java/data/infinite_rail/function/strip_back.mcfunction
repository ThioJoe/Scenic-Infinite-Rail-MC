# Invisible-track strip: wipe the columns that fell out of the window's WEST
# edge (bounded recursion, budget .stpB shared with strip_front -- see
# invis_tick). Advances .stpLo toward .stpA one column per call.
execute unless score .stpLo ir < .stpA ir run return 0
execute unless score .stpB ir matches 1.. run return 0
scoreboard players remove .stpB ir 1
scoreboard players operation .stpC ir = .stpLo ir
function infinite_rail:strip_col_clear
scoreboard players add .stpLo ir 1
function infinite_rail:strip_back
