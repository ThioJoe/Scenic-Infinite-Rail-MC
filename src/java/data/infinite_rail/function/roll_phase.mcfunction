# The chunk roll's phase machine -- the spread-out tail of roll_chunks
# (which see for the split's rationale and measurements). Runs positioned
# at the head, one slice per tick, driven from main (.started 1) and
# launch_tick (.started 2) -- so a missing head pauses a cycle exactly like
# it pauses building, and the cycle resumes when the head is selectable
# again. Slices, in dependency order:
#   1: track band, north neighbor row     2: track band, south neighbor row
#   3: the torch stub (torch_width -> roll_stub)
#   4: setworldspawn/spawnpoint roll forward; the cycle ends
# (The CENTER row runs synchronously on the trigger tick in roll_chunks --
# the builder's frontier lead depends on its generation order going out
# immediately; only the neighbor rows, whose entity-ticking role matters
# ~192 blocks later, can afford the 1-2 tick lag.) The thin one-block-deep
# row adds cover exactly the rows the old one-command ±15 box covered (see
# roll_add_row); each phase queues ~1 fresh chunk of generation per roll
# instead of all 3 in one tick -- that lump was the measured whole-roll
# burst.
execute if score .rollP ir matches 1 run data merge storage infinite_rail:args {dz:-15}
execute if score .rollP ir matches 1 run function infinite_rail:roll_add_row
execute if score .rollP ir matches 2 run data merge storage infinite_rail:args {dz:15}
execute if score .rollP ir matches 2 run function infinite_rail:roll_add_row
execute if score .rollP ir matches 3 run function infinite_rail:roll_stub
# Keep world spawn and respawn points moving with the ride so nothing is
# anchored to the origin.
execute if score .rollP ir matches 4 run setworldspawn ~ ~1 ~
execute if score .rollP ir matches 4 run spawnpoint @a ~ ~1 ~
scoreboard players add .rollP ir 1
execute if score .rollP ir matches 5.. run scoreboard players set .rollP ir 0
