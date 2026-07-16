# The torch stub's Z half-width, into .fw: 1 while torches aren't planting
# (a stub add is then a no-op over already-forced row chunks), raised to
# .TORCHRANGE (capped at 48; default 30 = exactly four rows under the
# Z ≡ 14 anchor) while torches ARE actively planting -- always-on mode (1)
# unconditionally, auto (2..) only while the shared torch_auto's latest
# answer (.torchlit, refreshed per built column by place_torch) says night.
# STILL NO CLOCK READ HERE: the width keys off the .TORCHMODE and .torchlit
# SCORES -- plain scoreboard reads, nothing version-risky; /time stays
# quarantined in time_now (see forceload_here's header for the full
# post-mortem rationale). The add-0 keeps a fresh world's unset .torchlit
# reading honestly as 0 = not lit.
# Shared by forceload_here (begin's synchronous bootstrap corridor) and
# roll_stub (the per-roll phase) -- keep it caller-agnostic.
scoreboard players add .torchlit ir 0
scoreboard players set .fw ir 1
execute if score .TORCHMODE ir matches 1 if score .TORCHRANGE cfg_ride > .fw ir run scoreboard players operation .fw ir = .TORCHRANGE cfg_ride
execute if score .TORCHMODE ir matches 2.. if score .torchlit ir matches 1 if score .TORCHRANGE cfg_ride > .fw ir run scoreboard players operation .fw ir = .TORCHRANGE cfg_ride
execute if score .fw ir matches 49.. run scoreboard players set .fw ir 48
