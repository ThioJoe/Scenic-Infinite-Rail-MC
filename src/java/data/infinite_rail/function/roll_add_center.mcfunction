# The roll's trigger-tick add (called from roll_chunks): force-add the
# track band's CENTER chunk row -- the rail strip's own row, the one row
# the builder cannot advance without -- out to .TERRAIN_GENAHEAD, the
# instant the roll fires (its generation order is the frontier lead; see
# roll_chunks' header). Wrapped in a store-success so the .flok health
# signal reads exactly this add: the one command whose success means "the
# corridor ahead is loading" (it gains at least one brand-new chunk column
# per 16-block roll, so a healthy pipeline always answers 1; the neighbor
# rows and the stub fail routinely and must not pollute it).
data merge storage infinite_rail:args {dz:0}
execute store success score .flok ir run function infinite_rail:roll_add_row
