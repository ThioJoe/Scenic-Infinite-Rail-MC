# The adjustable ride speed's shared state machine (both editions).
#
# There are THREE adjustable cruise speeds, and this file tunes whichever one
# is active right now:
#   .speed  (ir) -- the LAND cruising speed (default .DEFAULTSPEED).
#   .ocnspd (ir) -- the OCEAN cruise speed (default .OCEANSPEED), used while
#                   the ocean sprint owns the ride (.fast 1). Adjustable in
#                   BOTH directions here -- Speed - can take it below the ocean
#                   default mid-sprint. (The "ocean never slows the ride" rule
#                   lives in ocean_check/speed_up now, as a raise-only entry:
#                   .ocnspd = max(.OCEANSPEED, .speed) -- so the AUTOMATIC
#                   speed-up never lowers a fast rider, while a manual Speed -
#                   still can.)
#   .skyspd (ir) -- the SKY cruising speed (default .SKYSPEED), used while
#                   sky mode owns the ride (.SKYMODE 1).
# All three are seeded from their config default by modes_init exactly like
# .speed always was, so each context "jumps to its default" on first use but
# is adjustable from there, and a chosen value persists across /reload, ride
# restarts and rejoins. The Speed +/- items and Reset tune whichever context
# is active; the other two are untouched.
#
# Input:  .spdir (ir)  --  the change in blocks/s: positive = faster,
#                          negative = slower -- through 0 (parked) into
#                          reverse (speed_inc/speed_dec pass +/-.SPEEDSTEP
#                          from the shared consts.mcfunction;
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
# NO floor: the grid runs straight through 0 (parked) into NEGATIVE speeds
# (the ride runs backwards over the already-built track, until it reaches
# the start -- each edition's pace handles the direction and the stop at the
# track's west end natively). A single-notch click walks the selectable grid
#   ..., -16, -12, -8, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 8, 12, 16, ...
# -- by 1 between -6 and 8 (Speed - from 1 goes 0, then -1, -2, ...), by
# .SPEEDSTEP outside that, with the 6<->8 and -6<->-8 pairs bridging the
# zones (the negative side mirrors the positive grid). There is deliberately
# NO cap in either direction -- keep clicking Speed +/- for as long as you
# dare (Java's minecart max-speed gamerule enforces whatever bound vanilla
# itself has -- it holds the MAGNITUDE, the sign lives in the scores; Bedrock's
# virtual pace takes any value, though past a point the builder can't lay
# track fast enough and the pace soft-ceiling eases the ride off to the
# track buffer). A RESET from a reverse speed is direction-aware: backwards
# FASTER than the default (below -.spdef) resets to the reverse default
# (-.spdef); anywhere between -.spdef and 0 inclusive resets forward to the
# plain default -- so Reset is also the "get me moving east again" button.
# Reached from the Speed -/Reset/+ hotbar items, the Ride Settings menu's
# speed controls, and the speed_inc / speed_dec / speed_reset chat functions.

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
# The pre-change value: the grid's range tests below read it (so a
# half-updated .spcur can't confuse them), and the reset's direction rule
# needs it too -- so it is captured before anything changes.
scoreboard players operation .spold ir = .spcur ir
# Reset (.spdir 0): ALL the cruise speeds return to their defaults -- the
# two inactive ones here, the active one through .spcur below (it lands on
# the same default via .spdef, so the write-back stays uniform). Direction-
# aware for a ride running BACKWARDS: from below -.spdef (backwards faster
# than the default) the reset lands on -.spdef -- the reverse default --
# while anything from -.spdef up to 0 inclusive resets forward to +.spdef
# (the plain default; the line above already set it).
execute if score .spdir ir matches 0 run scoreboard players operation .speed ir = .DEFAULTSPEED cfg_ride
execute if score .spdir ir matches 0 run scoreboard players operation .ocnspd ir = .OCEANSPEED cfg_ride
execute if score .spdir ir matches 0 run scoreboard players operation .skyspd ir = .SKYSPEED cfg_ride
execute if score .spdir ir matches 0 run scoreboard players operation .spcur ir = .spdef ir
scoreboard players set .nspdef ir 0
scoreboard players operation .nspdef ir -= .spdef ir
execute if score .spdir ir matches 0 if score .spold ir < .nspdef ir run scoreboard players operation .spcur ir = .nspdef ir
# The selectable-speed grid. A single-notch Speed -/+ click (.spstep 1, from
# speed_inc / speed_dec -- the hotbar items and the chat functions) walks
# ALONG the grid
#   ..., -16, -12, -8, -6, -5, ..., -1, 0, 1, 2, 3, 4, 5, 6, 8, 12, 16, 20, ...
# -- by 1 through the fine middle zone (-6..8, straight through 0 into
# reverse), by .SPEEDSTEP (4) outside it, with the 6<->8 and mirrored
# -6<->-8 pairs bridging the zones. So Speed + climbs 1->2->...->6->8->12
# ->... and Speed - walks it back 8->6->5->...->1->0->-1->...->-6->-8->-12
# (0 = parked, negative = the ride runs backwards). Any OTHER input skips
# the grid and applies the delta verbatim: the Bedrock Ride Settings slider
# (.spstep 0, an absolute setter that already computed target-minus-current,
# so it must land on the exact value picked) and Reset (.spdir 0, resolved
# above). .spold was captured above, before the reset could overwrite it.
# There is deliberately NO cap in either direction, and NO floor anymore --
# the old floor of 1 is exactly what stop-and-reverse removed.
# Non-grid input (slider / reset): plain delta add.
execute unless score .spstep ir matches 1 run scoreboard players operation .spcur ir += .spdir ir
# Speed + one notch: +1 through the fine zone (-7..5), 6/7 jump to 8,
# +.SPEEDSTEP from 8 up; mirrored below: -8 jumps to -6, +.SPEEDSTEP from -9 down.
execute if score .spstep ir matches 1 if score .spdir ir matches 1.. if score .spold ir matches -7..5 run scoreboard players add .spcur ir 1
execute if score .spstep ir matches 1 if score .spdir ir matches 1.. if score .spold ir matches 6..7 run scoreboard players set .spcur ir 8
execute if score .spstep ir matches 1 if score .spdir ir matches 1.. if score .spold ir matches 8.. run scoreboard players operation .spcur ir += .SPEEDSTEP ir
execute if score .spstep ir matches 1 if score .spdir ir matches 1.. if score .spold ir matches -8 run scoreboard players set .spcur ir -6
execute if score .spstep ir matches 1 if score .spdir ir matches 1.. if score .spold ir matches ..-9 run scoreboard players operation .spcur ir += .SPEEDSTEP ir
# Speed - one notch: 8 drops to 6, -1 through the fine zone (-5..7 -- so 1
# lands on 0, 0 on -1), -.SPEEDSTEP above 8; mirrored: -6/-7 drop to -8,
# -.SPEEDSTEP from -8 down.
execute if score .spstep ir matches 1 if score .spdir ir matches ..-1 if score .spold ir matches -5..7 run scoreboard players remove .spcur ir 1
execute if score .spstep ir matches 1 if score .spdir ir matches ..-1 if score .spold ir matches 8 run scoreboard players set .spcur ir 6
execute if score .spstep ir matches 1 if score .spdir ir matches ..-1 if score .spold ir matches 9.. run scoreboard players operation .spcur ir -= .SPEEDSTEP ir
execute if score .spstep ir matches 1 if score .spdir ir matches ..-1 if score .spold ir matches -7..-6 run scoreboard players set .spcur ir -8
execute if score .spstep ir matches 1 if score .spdir ir matches ..-1 if score .spold ir matches ..-8 run scoreboard players operation .spcur ir -= .SPEEDSTEP ir
# Write the result back to the active cruise speed.
execute unless score .SKYMODE ir matches 1 unless score .fast ir matches 1 run scoreboard players operation .speed ir = .spcur ir
execute unless score .SKYMODE ir matches 1 if score .fast ir matches 1 run scoreboard players operation .ocnspd ir = .spcur ir
execute if score .SKYMODE ir matches 1 run scoreboard players operation .skyspd ir = .spcur ir
scoreboard players set .spdflt ir 0
execute if score .spcur ir = .spdef ir run scoreboard players set .spdflt ir 1
