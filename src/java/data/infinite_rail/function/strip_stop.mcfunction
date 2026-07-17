# Invisible-track strip: teardown sweep -- wipe whatever span the strip
# currently has placed (called by stop, and by begin's reset so a restarted
# ride can't strand the previous ride's strip rails in the world). Bounded:
# the placed span is the ~17-column window plus at most one budget-starved
# jump's leftovers; the 64 budget covers it with room. A blanket kill of any
# stray ir_strip displays (should be none after the wipe) closes the loop --
# they are strip-only, so this can never touch permanent ir_disp displays.
kill @e[type=block_display,tag=ir_strip]
execute unless score .stpAny ir matches 1 run return 0
execute unless score .stpLo ir = .stpLo ir run return 0
execute unless score .lineZ ir = .lineZ ir run return 0
scoreboard players set .stpB ir 64
scoreboard players operation .stpA ir = .stpHi ir
scoreboard players add .stpA ir 1
function infinite_rail:strip_back
scoreboard players reset .stpLo ir
scoreboard players reset .stpHi ir
scoreboard players reset .stpAt ir
