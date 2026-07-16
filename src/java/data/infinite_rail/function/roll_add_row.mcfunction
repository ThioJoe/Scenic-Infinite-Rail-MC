# One thin (one-block-deep in Z) track-band row add, positioned at the
# head: dz -- preset by the caller into storage infinite_rail:args -- picks
# the chunk row. 0 is the strip's own row; ±15 land exactly one row
# north/south under the Z ≡ 14 anchor (offsets -1 and 29). A thin line
# force-adds its whole chunk row, so the three calls cover exactly the rows
# the old one-command ±15 box covered (for a legacy unsnapped centerline
# they degrade to the same 2-3 rows the box covered there too). The
# neighbor rows are NOT optional -- see the forceload macro's header: a
# forced chunk only reaches its entity-ticking state once the chunks
# around it are generated, and a 1-row corridor starved the pipeline.
# gen is refreshed from the live config so a /reload tweak applies on the
# next roll. Returns the forceload's own result (for phase 1's .flok).
execute store result storage infinite_rail:args gen int 1 run scoreboard players get .TERRAIN_GENAHEAD cfg_ride
return run function infinite_rail:roll_row with storage infinite_rail:args
