# Invisible-track strip: place every invisible column in the window
# [.stpX .. .stpZ] (bounded recursion -- the window is ~11 columns; see
# invis_tick). No budget: re-placing an already-placed column is a pair of
# silently-failing setblocks, so a full pass is cheap and self-healing.
execute if score .stpX ir > .stpZ ir run return 0
scoreboard players operation .stpC ir = .stpX ir
function infinite_rail:strip_col_place
scoreboard players add .stpX ir 1
function infinite_rail:strip_fwd
