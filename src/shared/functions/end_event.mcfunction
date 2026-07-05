# The active climb/descent has reached the target elevation: return to flat
# and start counting the gap before the next event may begin. #dir stays 0, so
# this column is placed as a flat rail at the elevation just reached.
scoreboard players set #slope ir 0
scoreboard players set #flat ir 0
# Keep clearing the full center bore (no vegetation sparing) for the next
# #SLOPECLEAR columns -- the camera is still gliding down onto the new level
# here, floating above the rail line (see decide's carve-mode block).
scoreboard players operation #vclear ir = #SLOPECLEAR ir
