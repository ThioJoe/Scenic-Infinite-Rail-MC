# The per-tick build budget (.budget), auto-scaled to the ride's speed:
# the builder may lay .BUILD_FACTOR x the track the ride is consuming --
# ceil(active cruise in blocks/s x factor / 20 ticks) columns this tick,
# floored at 1. A fixed cap (the old .BUILD_PER_TICK 15) was sized for the
# fastest ride at any speed, so a catch-up burst after a chunk-generation
# hitch cost ~15 columns in ONE tick right when the server was already
# struggling; proportional, a land-speed burst is 1 column, an ocean
# sprint's 4, and the spike can never dwarf the ride it serves. The trade
# is recovery TIME (a fully drained 224-block buffer refills in seconds
# instead of one tick), which is invisible from the seat: track is laid
# faster than the cart eats it from the first tick either way.
#
# Two terms, the larger wins:
#   1. the TRACKED active cruise -- .skyspd in sky mode, .ocnspd mid-
#      sprint, else .speed (the same context pick as the shared
#      speed_step), which also keeps the budget honest while the cart is
#      momentarily stalled or unloaded (its measured motion reads 0);
#   2. the pace cart's MEASURED motion (.mx = Motion[0]x100, read by
#      main's stall keeper just before this runs) -- so a hand-set
#      /gamerule minecart speed above the tracked cruise still gets a
#      matching budget instead of outrunning the builder.
# Called by main each tick, right before build_loop.
scoreboard players operation .spact ir = .speed ir
execute if score .fast ir matches 1 run scoreboard players operation .spact ir = .ocnspd ir
execute if score .SKYMODE ir matches 1 run scoreboard players operation .spact ir = .skyspd ir
scoreboard players operation .spact ir *= .BUILD_FACTOR cfg_ride
scoreboard players add .spact ir 19
scoreboard players operation .spact ir /= .C20 ir
scoreboard players operation .budget ir = .mx ir
scoreboard players operation .budget ir *= .BUILD_FACTOR cfg_ride
scoreboard players add .budget ir 99
scoreboard players operation .budget ir /= .C100 ir
execute if score .budget ir < .spact ir run scoreboard players operation .budget ir = .spact ir
# The floor: a stalled ride with a zeroed (or hand-broken) speed must still
# out-build its own recovery -- 1 column/tick lays 20 blocks/s of track.
execute unless score .budget ir matches 1.. run scoreboard players set .budget ir 1
