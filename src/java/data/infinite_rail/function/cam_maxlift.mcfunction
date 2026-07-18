# lifted() at column .cmctr, into .cmlv:
#   lifted = min( max of railY over [.cmctr-.cmw .. .cmctr+.cmw],  railY(.cmctr)+.cmlift )
# The max window (.cmw = lift columns, SYMMETRIC) holds the flat/crest level
# over a convex top and rises just before a slope; the +.cmlift cap keeps it
# exactly .CAMLIFT above the rail mid-slope. Runs the max scan (cam_maxscan,
# which also captures the center rail .cmr), then takes the min.
scoreboard players set .cmmx ir -2000000000
scoreboard players set .cmk ir 0
scoreboard players operation .cmk ir -= .cmw ir
function infinite_rail:cam_maxscan
scoreboard players operation .cmlv ir = .cmr ir
scoreboard players operation .cmlv ir += .cmlift ir
execute if score .cmmx ir < .cmlv ir run scoreboard players operation .cmlv ir = .cmmx ir
