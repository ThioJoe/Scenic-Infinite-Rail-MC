# Invisible-track strip: wipe the columns that fell out of the window's EAST
# edge -- that only happens while the ride runs BACKWARDS (negative speed),
# and it is what keeps the strip from leaving a growing trail of rails under
# the reversing rider. Bounded recursion, budget .stpB shared with
# strip_back (see invis_tick). Walks .stpHi down toward .stpZ.
execute unless score .stpHi ir > .stpZ ir run return 0
execute unless score .stpB ir matches 1.. run return 0
scoreboard players remove .stpB ir 1
scoreboard players operation .stpC ir = .stpHi ir
function infinite_rail:strip_col_clear
scoreboard players remove .stpHi ir 1
function infinite_rail:strip_front
