# Computes the forceload macro's arguments and runs it at the current
# position. Since the roll went phased (roll_chunks/roll_phase) this is
# BEGIN'S SYNCHRONOUS BOOTSTRAP ONLY -- the initial corridor must exist
# before the first column is placed, so the one-command whole-corridor add
# is exactly right there; the per-roll path spreads the same adds one row
# per tick instead (roll_add_row/roll_stub):
#   gen = .TERRAIN_GENAHEAD -- the TRACK BAND's reach: how far ahead
#         terrain is force-generated for the sampler and the builder. The
#         band is three chunk rows (+-15 blocks): the strip's own row (the
#         Z ≡ 14 anchor keeps z-1..z+1 = offsets 13..15 inside one row)
#         plus one neighbor row each side -- see the macro's note for why
#         the neighbors are load-bearing (a 1-row add starves the
#         pipeline's entity-ticking frontier).
#   w   = the TORCH STUB's Z half-width (the short wide add around the head
#         -- see the forceload macro): 1 while torches aren't planting (the
#         stub add is then a no-op), raised to .TORCHRANGE (capped at 48;
#         default 30 = exactly four rows under the anchor) while torches
#         ARE actively planting -- always-on mode unconditionally, auto
#         mode only while the shared torch_auto's latest answer (.torchlit)
#         says night. Thrown torches land in loaded, generated chunks, and
#         an auto-mode DAY no longer generates four rows of chunks no torch
#         will ever use (that band was the single biggest avoidable
#         world-gen load on weak machines).
#
# STILL NO CLOCK READ IN THIS FILE: the width keys off the .TORCHMODE and
# .torchlit SCORES -- plain scoreboard reads, nothing version-risky. This
# file is the heart of the chunk pipeline, and /time is the pack's most
# version-turbulent command (26.1 reworked it around World Clocks):
# anything that can fail to parse in THIS file kills forceloading outright,
# and with the corridor dead the head marker's chunk unloads while the
# scoreboard state keeps advancing -- the track/camera divergence bug. That
# is why an earlier revision refused to consult the clock AT ALL (the old
# blanket "clock-blind" width, which bought safety by loading the full band
# through every auto-mode day). Reading back the answer place_torch already
# computed -- .torchlit, refreshed per built column through the quarantined
# time_now -- gets the day-narrowing without letting /time anywhere near
# this file, and a broken clock still fails safe: .torchlit reads 0, the
# corridor stays narrow, and auto mode wasn't planting torches anyway.
# Staleness is bounded and harmless: a dusk flip widens on the next
# 16-block roll at the latest, so the first few night throws may land in
# unloaded chunks and silently skip -- the same graceful degradation torch
# placement has everywhere else (and at most one roll's worth at a night
# ride start, before the first built column refreshes the score).
execute store result storage infinite_rail:args gen int 1 run scoreboard players get .TERRAIN_GENAHEAD cfg_ride
# The torch stub's width (.fw) -- the shared torch_width computes it (the
# same file the per-roll stub phase uses, so the two paths can never
# disagree about when the wide band exists).
function infinite_rail:torch_width
execute store result storage infinite_rail:args w int 1 run scoreboard players get .fw ir
# The store-success feeds roll_chunks' one-shot broken-forceload warning
# (.flok, preset to 0 there): 1 = the macro ran, 0 = it failed (file missing
# on this version / macro expansion error / the command itself rejected).
execute store success score .flok ir run function infinite_rail:forceload with storage infinite_rail:args
