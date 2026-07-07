# The adjustable ride speed's shared state machine (both editions).
#
# Input:  .spdir (ir)  --  the change in blocks/s: positive = faster,
#                          negative = slower (speed_inc/speed_dec pass
#                          +/-.SPEEDSTEP from the shared consts.mcfunction;
#                          Bedrock's settings slider passes an exact delta),
#                          0 = reset to the config default.
# Output: .speed (ir)  --  the ride's LAND cruising speed. STATE, not
#                          config: it survives /reload, ride restarts and
#                          rejoins (seeded from .MAXSPEED by modes_init the
#                          first time, reset only by the menu's Reset).
#         .spdflt (ir) --  1 = the new speed equals the config default
#                          .MAXSPEED (the caller's message appends
#                          "(default)").
#
# Floored at 1 (and a +one-step click from that floor rejoins the .SPEEDSTEP
# grid at 4 instead of landing on 5); there is deliberately NO upper cap -- keep clicking Speed +
# for as long as you dare (Java's minecart max-speed gamerule enforces
# whatever bound vanilla itself has; Bedrock's virtual pace takes any value,
# though past a point the builder can't lay track fast enough and the pace
# soft-ceiling eases the ride off to the track buffer). The APPLY is native
# per edition: Java pushes .speed into the minecart max-speed gamerule
# (speed_apply); Bedrock's script reads .speed as the virtual pace target
# every tick. Reached from the Speed +/- hotbar items, the Ride Settings menu's
# speed controls, and the speed_inc / speed_dec / speed_reset chat functions.
# Remember whether this change starts from the clamp floor (speed 1): the
# floor is the one value that can knock the speed off the .SPEEDSTEP grid
# (4, 8, 12, ...), so a single +one-step click from there lands back ON the
# grid (4) instead of 5. Only the exact +.SPEEDSTEP request gets the
# treatment -- larger deltas (Bedrock's slider) mean an exact value.
scoreboard players set .spfloor ir 0
execute if score .speed ir matches 1 run scoreboard players set .spfloor ir 1
execute if score .spdir ir matches 0 run scoreboard players operation .speed ir = .MAXSPEED cfg_ride
scoreboard players operation .speed ir += .spdir ir
scoreboard players set .sclamp ir 1
scoreboard players operation .speed ir > .sclamp ir
execute if score .spfloor ir matches 1 if score .spdir ir = .SPEEDSTEP ir run scoreboard players operation .speed ir = .SPEEDSTEP ir
scoreboard players set .spdflt ir 0
execute if score .speed ir = .MAXSPEED cfg_ride run scoreboard players set .spdflt ir 1
