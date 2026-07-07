# (a function macro) Plant $(n) sea pickles (config .SEAPICKLE, 1..4) in the
# current cell, waterlogged so they stay submerged and glow -- torch mode's
# stand-in for a torch where the ground below is water (see torch_try). Runs
# positioned in the bottom water cell (one above the ocean_floor bed). No
# `keep`: the caller already verified this cell is water, and a waterlogged
# pickle keeps the water visual, so the plain setblock is what puts the pickle
# IN the water. $(n) is handed in via storage infinite_rail:pickle because
# block states can't be read from a scoreboard.
$setblock ~ ~ ~ minecraft:sea_pickle[pickles=$(n),waterlogged=true]
