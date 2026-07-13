# One-column slide of the surface cache (see surf_roll): the head moved one
# east, so the entry it passed falls off the front and one "never probed"
# slot opens at the far end (filled lazily by the first walk that reads it).
data remove storage infinite_rail:surf c[0]
data modify storage infinite_rail:surf c append value -32768
scoreboard players add .surfBase ir 1
