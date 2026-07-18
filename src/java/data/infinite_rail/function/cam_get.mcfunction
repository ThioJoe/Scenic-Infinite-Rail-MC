# Macro helper: reads one column's rail height from the track history list
# into .ly (the shared cam_get output -- also read by cam_sample, strip_col,
# pace_watch and pace_fix). NBT paths only take literal indices, so it arrives
# as a macro arg.
$execute store result score .ly ir run data get storage infinite_rail:track y[$(i)]
