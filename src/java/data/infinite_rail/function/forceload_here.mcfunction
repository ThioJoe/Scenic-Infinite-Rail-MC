# Computes the forceload macro's arguments and runs it at the current
# position (the head marker for roll_chunks, the starting player for begin):
#   gen = .TERRAIN_GENAHEAD -- how far ahead terrain is force-generated
#   w   = the corridor's Z half-width: 8 (+-1 chunk) normally, raised to
#         .TORCHRANGE (capped at 48) while torch mode is on OR auto, so
#         randomly thrown torches always land in loaded, generated chunks
#         instead of silently failing to place past the standard band.
#
# DELIBERATELY CLOCK-BLIND: the width keys off the .TORCHMODE score alone,
# NOT off torch_auto's live is-it-night answer. An earlier revision fetched
# the clock here (`time query` + torch_auto) to keep the corridor narrow
# through auto-mode days -- but this file is the heart of the chunk
# pipeline, and /time is the pack's most version-turbulent command (26.1
# reworked it around World Clocks): anything that can fail to parse in THIS
# file kills forceloading outright, and with the corridor dead the head
# marker's chunk unloads while the scoreboard state keeps advancing -- the
# track/camera divergence bug. A few extra daytime chunks in auto mode is
# cheap insurance by comparison; the clock read now lives quarantined in
# time_now.mcfunction, called only by place_torch.
execute store result storage infinite_rail:args gen int 1 run scoreboard players get .TERRAIN_GENAHEAD cfg_ride
scoreboard players set .fw ir 8
execute if score .TORCHMODE ir matches 1.. if score .TORCHRANGE cfg_ride > .fw ir run scoreboard players operation .fw ir = .TORCHRANGE cfg_ride
execute if score .fw ir matches 49.. run scoreboard players set .fw ir 48
execute store result storage infinite_rail:args w int 1 run scoreboard players get .fw ir
# The store-success feeds roll_chunks' one-shot broken-forceload warning
# (.flok, preset to 0 there): 1 = the macro ran, 0 = it failed (file missing
# on this version / macro expansion error / the command itself rejected).
execute store success score .flok ir run function infinite_rail:forceload with storage infinite_rail:args
