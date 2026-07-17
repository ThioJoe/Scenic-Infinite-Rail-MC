# Invisible-track strip: wipe the just-in-time rail off column .stpC again
# (only when strip_col says it is an invisible column -- real track is never
# touched). Wiping cells the strip never actually placed is a harmless pair
# of no-op setblocks (air onto air).
function infinite_rail:strip_col
execute if score .stok ir matches 1 run function infinite_rail:strip_wipe with storage infinite_rail:strip
