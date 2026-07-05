# The near-ground scan feeding the shared brain's slope-timing guards
# (decide's .dig/.dig2/.push and consider_start's early climb -- CONTEXT.md
# section 7j). Probes the surface heightmap every 2 blocks over the next
# max(.UPLOOK, .DOWNLOOK) blocks east of the head (odd offsets +1, +3, +5,
# ...) and boils the reads down to two scores for the shared decide:
#   .gfloor = the HIGHEST surface within .DOWNLOOK (the descent guard: a
#             down-step may never land below .gfloor + .DOWNGRACE)
#   .gmax   = the HIGHEST surface within .UPLOOK  (the climb contact trigger)
# Both start at the -10000 sentinel and only valid probes raise them, so a
# window of 0 or a scan with no generated terrain fails every guard open
# (the ground-contact rules go inert). Must run positioned at the head
# marker, like sample_window. The scan is capped at 48 blocks -- the sample
# window's own reach, always inside the force-generated corridor.
scoreboard players operation .nw ir = .UPLOOK ir
scoreboard players operation .nw ir > .DOWNLOOK ir
execute if score .nw ir matches 49.. run scoreboard players set .nw ir 48
scoreboard players set .gfloor ir -10000
scoreboard players set .gmax ir -10000
scoreboard players set .nk ir 1
execute if score .nw ir matches 1.. positioned ~1 ~ ~ run function infinite_rail:near_step
