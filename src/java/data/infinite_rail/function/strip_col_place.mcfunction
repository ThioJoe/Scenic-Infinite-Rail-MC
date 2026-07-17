# Invisible-track strip: place the just-in-time rail for column .stpC (only
# when strip_col says it is an invisible column with resolvable geometry).
function infinite_rail:strip_col
execute if score .stok ir matches 1 run function infinite_rail:strip_set with storage infinite_rail:strip
