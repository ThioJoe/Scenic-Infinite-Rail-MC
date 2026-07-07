# Torch mode's placement gate -- the ONE place both editions decide whether
# newly built columns get torches RIGHT NOW. .TORCHMODE is a tri-state
# (0 = off, 1 = always on, 2 = auto -- the default, seeded by modes_init):
# in auto, torches are planted only while the world clock says night, so the
# line lights its own way as darkness falls and track built in daylight
# stays clean. Nothing is ever removed -- at daybreak torches simply stop
# appearing on new columns (the placed ones unload behind the ride with
# their chunks like everything else).
#
# Inputs (the caller sets both just before the call -- fetching the clock is
# native per edition, because Bedrock has no `execute store`):
#   .TORCHMODE  the tri-state above (state, survives /reload and rejoins)
#   .tod        time of day 0..23999 (Java: `execute store result score .tod
#               ir run time query daytime`; Bedrock: world.getTimeOfDay()
#               handed in through the script's brain bridge)
# Output:
#   .torchlit   1 = plant torches beside new columns, 0 = leave them unlit
#
# Callers: Java place_torch (per candidate column) and forceload_here (the
# corridor widening); Bedrock torchLit() in scripts/main.js (cached ~1 s).
#
# The night window is 12542..23459 -- the vanilla "beds are usable" span,
# from the sun half-set at dusk to the first light of dawn -- the same
# 0..23999 clock on both editions. The tri-state time mode composes for
# free: mode_night_on freezes the clock at midnight (18000, inside the
# window -- auto plants around the clock), mode_day_on at noon (6000,
# outside -- auto never plants).
scoreboard players set .torchlit ir 0
# Normalize the clock first: scoreboard %= is a floor-mod, so a raw day
# time (0..23999) passes through unchanged while a 26.1-era world clock's
# total-elapsed-ticks reading folds back into one day (see .C24000 in the
# shared consts). An unset .tod reads as 0 = noon-ish = unlit, so a broken
# clock fetch degrades to "auto plants nothing" and nothing worse.
scoreboard players operation .tod ir %= .C24000 ir
execute if score .TORCHMODE ir matches 1 run scoreboard players set .torchlit ir 1
execute if score .TORCHMODE ir matches 2 if score .tod ir matches 12542..23459 run scoreboard players set .torchlit ir 1
