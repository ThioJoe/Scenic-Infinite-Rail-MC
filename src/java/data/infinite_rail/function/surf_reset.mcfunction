# Rebuild the surface cache empty (see surf_roll): base = head + 1, .suL
# "never probed" (-32768) slots. Every entry is then probed exactly once, by
# the first walk that reads it -- so the column after a reset costs what a
# column used to cost, and every column after that is nearly probe-free.
data modify storage infinite_rail:surf c set value []
scoreboard players operation .surfBase ir = .suB ir
scoreboard players operation .suK ir = .suL ir
function infinite_rail:surf_seed
