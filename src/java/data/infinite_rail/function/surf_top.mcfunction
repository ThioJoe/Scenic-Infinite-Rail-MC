# (macro, h = the carve height; positioned at a side cell at rail level)
# surf_note's no-air fallback: the whole span is solid, so the TOP cell of
# the span stands in as the "surface" -- a shallow tunnel face grazing just
# under a meadow classifies as grass and gets restored, while deep
# rock/dirt classifies 0 and the exposed ground is left alone.
$execute positioned ~ ~$(h) ~ run function infinite_rail:surf_class
