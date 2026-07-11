# (positioned at a SIDE cell of the bore, at rail level, AFTER the clear)
# Applies the surface class surf_note remembered for this stack before the
# carve (the caller copies .sfl / .sfr into .sfc): walk down to the newly
# exposed top block and paint it back into the old surface material (see
# surf_fix_step).
scoreboard players set .scy ir 0
function infinite_rail:surf_fix_step
