# The adjustable ride speed's shared state machine (both editions).
#
# There are THREE adjustable cruise speeds, and this file tunes whichever one
# is active right now:
#   .speed  (ir) -- the LAND cruising speed (default .DEFAULTSPEED).
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
#                          0 = reset. A reset is TOTAL: all three cruise
#                          speeds return to their config defaults, not just
#                          the active one -- so one Reset press mid-ocean
#                          also guarantees the ride comes back to the
#                          default land speed when the sprint ends (a land
#                          speed quietly adjusted some time ago used to
#                          survive the reset and read as "the ocean speed
#                          never reset").
#         .spstep (ir) --  1 = a single-notch Speed -/+ hotbar/chat click, so
#                          the change WALKS the selectable-speed grid (fine by 1
#                          below 8, coarse by .SPEEDSTEP from 8 up -- see below).
#                          0 = an absolute delta (Bedrock's Ride Settings slider)
#                          or a reset: the delta is applied verbatim, off-grid,
#                          so the slider lands on the exact value the user chose.
#                          Every caller sets it (inc/dec = 1, reset/slider = 0).
# Output: .spcur (ir)  --  the NEW active cruise speed (== the just-updated
#                          .speed, .ocnspd or .skyspd). The native
#                          apply/report reads this so it never re-branches on
#                          the context: Java's speed_apply pushes it into the
#                          minecart max-speed gamerule and prints it;
#                          Bedrock's speed_msg prints it (the script reads
#                          the three scores as the virtual pace target).
#         .speed / .ocnspd / .skyspd -- the active one gets the result.
#         .spdflt (ir) --  1 = the new value equals the active config default
#                          (.DEFAULTSPEED / .OCEANSPEED / .SKYSPEED -- the
#                          caller's message appends "(default)").
#
# Floored at 1. A single-notch click walks the selectable grid 1, 2, 3, 4, 5, 6,
# 8, 12, 16, ... -- by 1 below 8, by .SPEEDSTEP from 8 up (so Speed - from 8
# lands on 6, and Speed + from 1 climbs 2, 3, 4, 5, 6 before jumping to 8);
# there is deliberately NO upper cap -- keep
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
scoreboard players operation .spdef ir = .DEFAULTSPEED cfg_ride
execute unless score .SKYMODE ir matches 1 if score .fast ir matches 1 run scoreboard players operation .spcur ir = .ocnspd ir
execute unless score .SKYMODE ir matches 1 if score .fast ir matches 1 run scoreboard players operation .spdef ir = .OCEANSPEED cfg_ride
execute if score .SKYMODE ir matches 1 run scoreboard players operation .spcur ir = .skyspd ir
execute if score .SKYMODE ir matches 1 run scoreboard players operation .spdef ir = .SKYSPEED cfg_ride
# Reset (.spdir 0): ALL the cruise speeds return to their defaults -- the
# two inactive ones here, the active one through .spcur below (it lands on
# the same default via .spdef, so the write-back stays uniform).
execute if score .spdir ir matches 0 run scoreboard players operation .speed ir = .DEFAULTSPEED cfg_ride
execute if score .spdir ir matches 0 run scoreboard players operation .ocnspd ir = .OCEANSPEED cfg_ride
execute if score .spdir ir matches 0 run scoreboard players operation .skyspd ir = .SKYSPEED cfg_ride
execute if score .spdir ir matches 0 run scoreboard players operation .spcur ir = .spdef ir
# The selectable-speed grid. A single-notch Speed -/+ click (.spstep 1, from
# speed_inc / speed_dec -- the hotbar items and the chat functions) walks
# ALONG the grid
#   1, 2, 3, 4, 5, 6, 8, 12, 16, 20, ...
# -- by 1 below 8, by .SPEEDSTEP (4) from 8 up, with the 6<->8 pair bridging
# the two zones. So Speed + climbs 1->2->...->6->8->12->..., and Speed - walks
# it back 8->6->5->...->1 (floored at 1). Any OTHER input skips the grid and
# applies the delta verbatim: the Bedrock Ride Settings slider (.spstep 0, an
# absolute setter that already computed target-minus-current, so it must land
# on the exact value picked) and Reset (.spdir 0, resolved above). .spold holds
# the pre-change value so the range tests below read the old speed, not a
# half-updated one. There is deliberately NO upper cap.
scoreboard players operation .spold ir = .spcur ir
# Non-grid input (slider / reset): plain delta add.
execute unless score .spstep ir matches 1 run scoreboard players operation .spcur ir += .spdir ir
# Speed + one notch: +1 up to 6, then 6/7 jump to 8, then +.SPEEDSTEP from 8 up.
execute if score .spstep ir matches 1 if score .spdir ir matches 1.. if score .spold ir matches ..5 run scoreboard players add .spcur ir 1
execute if score .spstep ir matches 1 if score .spdir ir matches 1.. if score .spold ir matches 6..7 run scoreboard players set .spcur ir 8
execute if score .spstep ir matches 1 if score .spdir ir matches 1.. if score .spold ir matches 8.. run scoreboard players operation .spcur ir += .SPEEDSTEP ir
# Speed - one notch: 8 drops to 6, -1 below 8, -.SPEEDSTEP above 8 (floored below).
execute if score .spstep ir matches 1 if score .spdir ir matches ..-1 if score .spold ir matches ..7 run scoreboard players remove .spcur ir 1
execute if score .spstep ir matches 1 if score .spdir ir matches ..-1 if score .spold ir matches 8 run scoreboard players set .spcur ir 6
execute if score .spstep ir matches 1 if score .spdir ir matches ..-1 if score .spold ir matches 9.. run scoreboard players operation .spcur ir -= .SPEEDSTEP ir
# Never below the floor of 1.
scoreboard players set .sclamp ir 1
scoreboard players operation .spcur ir > .sclamp ir
# Write the result back to the active cruise speed.
execute unless score .SKYMODE ir matches 1 unless score .fast ir matches 1 run scoreboard players operation .speed ir = .spcur ir
execute unless score .SKYMODE ir matches 1 if score .fast ir matches 1 run scoreboard players operation .ocnspd ir = .spcur ir
execute if score .SKYMODE ir matches 1 run scoreboard players operation .skyspd ir = .spcur ir
scoreboard players set .spdflt ir 0
execute if score .spcur ir = .spdef ir run scoreboard players set .spdflt ir 1
