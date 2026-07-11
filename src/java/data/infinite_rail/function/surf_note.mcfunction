# (positioned at a SIDE cell of the bore, at rail level) Pre-scan for the
# surface restoration: before this stack is cleared, find its ORIGINAL
# surface -- the topmost block below the bottommost air cell of the span
# about to be carved (0..ch above the rail; the walk stops at the FIRST
# air, so an overhead canopy never hides the true ground) -- and classify
# it into .sfc (surf_class: grass / podzol / mycelium / moss / snow).
# A span with no air at all (a full tunnel face) classifies its TOP cell
# instead: a tunnel grazing just under a meadow still restores grass,
# while deep rock classifies 0 = leave alone. Called by carve before any
# block is touched; surf_fix applies the class after the clear.
scoreboard players set .sfc ir 0
scoreboard players set .sks ir 0
scoreboard players set .scy ir 0
scoreboard players set .sdone ir 0
function infinite_rail:surf_note_step
execute if score .sdone ir matches 0 run function infinite_rail:surf_top with storage infinite_rail:carve
