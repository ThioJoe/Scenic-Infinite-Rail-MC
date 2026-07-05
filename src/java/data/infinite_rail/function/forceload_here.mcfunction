# Computes the forceload macro's arguments and runs it at the current
# position (the head marker for roll_chunks, the starting player for begin):
#   gen = #GENAHEAD -- how far ahead terrain is force-generated
#   w   = the corridor's Z half-width: 8 (+-1 chunk) normally, raised to
#         #TORCHRANGE (capped at 48) while torch mode is on, so randomly
#         thrown torches always land in loaded, generated chunks instead of
#         silently failing to place past the standard band.
execute store result storage infinite_rail:args gen int 1 run scoreboard players get #GENAHEAD ir
scoreboard players set #fw ir 8
execute if score #TORCHMODE ir matches 1 if score #TORCHRANGE ir > #fw ir run scoreboard players operation #fw ir = #TORCHRANGE ir
execute if score #fw ir matches 49.. run scoreboard players set #fw ir 48
execute store result storage infinite_rail:args w int 1 run scoreboard players get #fw ir
function infinite_rail:forceload with storage infinite_rail:args
