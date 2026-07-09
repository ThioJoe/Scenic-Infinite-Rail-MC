# The adjustable ride speed's shared state machine (both editions).
#
# There are TWO adjustable cruise speeds, and this file tunes whichever one is
# active right now:
#   .speed  (ir) -- the LAND cruising speed (default .MAXSPEED). Used on the
#                   ground and, via max(.OCEANSPEED, .speed), over the ocean.
#   .skyspd (ir) -- the SKY cruising speed (default .SKYSPEED), used only while
#                   sky mode owns the ride. Seeded from .SKYSPEED by modes_init
#                   exactly like .speed from .MAXSPEED, so a chosen sky speed
#                   persists across /reload, ride restarts and rejoins too.
# While .SKYMODE is 1 the Speed +/- items and Reset tune .skyspd (so sky mode
# jumps to its own default on entry but is adjustable from there); otherwise
# they tune .speed. Both are STATE, not config.
#
# Input:  .spdir (ir)  --  the change in blocks/s: positive = faster,
#                          negative = slower (speed_inc/speed_dec pass
#                          +/-.SPEEDSTEP from the shared consts.mcfunction;
#                          Bedrock's settings slider passes an exact delta),
#                          0 = reset to the active default.
# Output: .spcur (ir)  --  the NEW active cruise speed (== the just-updated
#                          .speed or .skyspd). The native apply/report reads
#                          this so it never has to re-branch on sky mode:
#                          Java's speed_apply pushes it into the minecart
#                          max-speed gamerule and prints it; Bedrock's
#                          speed_msg prints it (the script reads .speed /
#                          .skyspd as the virtual pace target every tick).
#         .speed / .skyspd -- the active one is written back with the result.
#         .spdflt (ir) --  1 = the new value equals the active config default
#                          (.MAXSPEED on land, .SKYSPEED in sky mode -- the
#                          caller's message appends "(default)").
#
# Floored at 1 (and a +one-step click from that floor rejoins the .SPEEDSTEP
# grid at 4 instead of landing on 5); there is deliberately NO upper cap -- keep
# clicking Speed + for as long as you dare (Java's minecart max-speed gamerule
# enforces whatever bound vanilla itself has; Bedrock's virtual pace takes any
# value, though past a point the builder can't lay track fast enough and the
# pace soft-ceiling eases the ride off to the track buffer). Reached from the
# Speed +/- and Reset hotbar items, the Ride Settings menu's speed controls,
# and the speed_inc / speed_dec / speed_reset chat functions.

# Pick the ACTIVE target + its config default into the working copy .spcur /
# .spdef: the sky cruise (.skyspd / .SKYSPEED) while sky mode owns the ride,
# else the land speed (.speed / .MAXSPEED). The math below runs on .spcur, so
# there is one code path for both, and the result is written back to whichever
# target is active.
execute unless score .SKYMODE ir matches 1 run scoreboard players operation .spcur ir = .speed ir
execute unless score .SKYMODE ir matches 1 run scoreboard players operation .spdef ir = .MAXSPEED cfg_ride
execute if score .SKYMODE ir matches 1 run scoreboard players operation .spcur ir = .skyspd ir
execute if score .SKYMODE ir matches 1 run scoreboard players operation .spdef ir = .SKYSPEED cfg_ride
# Remember whether this change starts from the clamp floor (speed 1): the floor
# is the one value that can knock the speed off the .SPEEDSTEP grid (4, 8, 12,
# ...), so a single +one-step click from there lands back ON the grid (4)
# instead of 5. Only the exact +.SPEEDSTEP request gets the treatment -- larger
# deltas (Bedrock's slider) mean an exact value.
scoreboard players set .spfloor ir 0
execute if score .spcur ir matches 1 run scoreboard players set .spfloor ir 1
execute if score .spdir ir matches 0 run scoreboard players operation .spcur ir = .spdef ir
scoreboard players operation .spcur ir += .spdir ir
scoreboard players set .sclamp ir 1
scoreboard players operation .spcur ir > .sclamp ir
execute if score .spfloor ir matches 1 if score .spdir ir = .SPEEDSTEP ir run scoreboard players operation .spcur ir = .SPEEDSTEP ir
# Write the result back to the active cruise speed.
execute unless score .SKYMODE ir matches 1 run scoreboard players operation .speed ir = .spcur ir
execute if score .SKYMODE ir matches 1 run scoreboard players operation .skyspd ir = .spcur ir
scoreboard players set .spdflt ir 0
execute if score .spcur ir = .spdef ir run scoreboard players set .spdflt ir 1
