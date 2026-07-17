# Macro helper for strip_col: read one entry of the per-column visibility
# list (storage infinite_rail:track v -- 0 = built invisible, 1 = visible)
# into .stv. NBT paths only take literal indices, so the index arrives as a
# macro arg (storage infinite_rail:cami i, shared with cam_get). A failed
# read (index past the list's end) leaves the caller's preset 1 = visible.
$execute store result score .stv ir run data get storage infinite_rail:track v[$(i)]
