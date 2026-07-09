# The adjustable ride speed's shared state machine (both editions).
#
# There are THREE adjustable cruise speeds, and this file tunes whichever one
# is active right now:
#   .speed  (ir) -- the LAND cruising speed (default .MAXSPEED).
#   .ocnspd (ir) -- the OCEAN cruise speed (default .OCEANSPEED), used while
#                   the ocean sprint owns the ride (.fast 1). Adjustable in
#                   BOTH directions -- the old max(.OCEANSPEED, .speed) rule
#                   ("the ocean never slows the ride") is gone: the ocean has
#                   its own speed now, and Speed - below the ocean default
#                   works like anywhere else.
#   .skyspd (ir) -- the SKY cruising speed (default .SKYSPEED), used while
#                   sky mode owns the ride (.SKYMODE 1).
# All three are seeded from their config default by modes_init exactly like
# .speed always was, so each context "jumps to its default" on first use but
# is adjustable from there, and a chosen value persists across /reload, ride
# restarts and rejoins. The Speed +/- items and Reset tune whichever context
# is active; the other two are untouched.
#
# Input:  .spdir (ir)  --  the change in blocks/s: positive = faster,
#                          negative = slower (speed_inc/speed_dec pass
#                          +/-.SPEEDSTEP from the shared consts.mcfunction;
#                          Bedrock's settings slider passes an exact delta),
#                          0 = reset to the active default.
# Output: .spcur (ir)  --  the NEW active cruise speed (== the just-updated
#                          .speed, .ocnspd or .skyspd). The native
#                          apply/report reads this so it never re-branches on
#                          the context: Java's speed_apply pushes it into the
#                          minecart max-speed gamerule and prints it;
#                          Bedrock's speed_msg prints it (the script reads
#                          the three scores as the virtual pace target).
#         .speed / .ocnspd / .skyspd -- the active one gets the result.
#         .spdflt (ir) --  1 = the new value equals the active config default
#                          (.MAXSPEED / .OCEANSPEED / .SKYSPEED -- the
#                          caller's message appends "(default)").
#
# Floored at 1 (and a +one-step click from that floor rejoins the .SPEEDSTEP
# grid at 4 instead of landing on 5); there is deliberately NO upper cap -- keep
# clicking Speed + for as long as you dare (Java's minecart max-speed gamerule
# enforces whatever bound vanilla itself has; Bedrock's virtual pace takes any
# value, though past a point the builder can't lay track fast enough and the
# pace soft-ceiling eases the ride off to the track buffer). Reached from the
# Speed -/Reset/+ hotbar items, the Ride Settings menu's speed controls, and
# the speed_inc / speed_dec / speed_reset chat functions.

# Pick the ACTIVE target + its config default into the working copy .spcur /
# .spdef: sky mode wins (it also zeroes .fast on entry), then the ocean sprint
# (.fast 1), else land. The math below runs on .spcur, so there is one code
# path for all three, and the result is written back to the active target.
scoreboard players operation .spcur ir = .speed ir
scoreboard players operation .spdef ir = .MAXSPEED cfg_ride
execute unless score .SKYMODE ir matches 1 if score .fast ir matches 1 run scoreboard players operation .spcur ir = .ocnspd ir
execute unless score .SKYMODE ir matches 1 if score .fast ir matches 1 run scoreboard players operation .spdef ir = .OCEANSPEED cfg_ride
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
execute unless score .SKYMODE ir matches 1 unless score .fast ir matches 1 run scoreboard players operation .speed ir = .spcur ir
execute unless score .SKYMODE ir matches 1 if score .fast ir matches 1 run scoreboard players operation .ocnspd ir = .spcur ir
execute if score .SKYMODE ir matches 1 run scoreboard players operation .skyspd ir = .spcur ir
scoreboard players set .spdflt ir 0
execute if score .spcur ir = .spdef ir run scoreboard players set .spdflt ir 1
