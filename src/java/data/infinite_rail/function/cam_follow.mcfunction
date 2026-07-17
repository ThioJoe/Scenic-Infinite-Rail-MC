# Per-tick camera driver (see CONTEXT.md 7g). The rider sits -- permanently,
# mounted exactly once per ride -- in a real minecart (ir_ride) glued to the
# invisible camera seat (ir_seat), and this function flies that rig along a
# CONSTRUCTED S-curve (.PACE_CART_BEHIND - .RIDER_BEHIND) blocks ahead of the hidden pace cart, built
# from the track's recorded profile:
#
#   lifted(x) = min( max of railY over [x-.CAMLIFT-3 .. x+.CAMLIFT+2],  railY(x)+.CAMLIFT )
#   c1(x)     = average of lifted() over [x-.CAMBLEND/2 .. x+.CAMBLEND/2]
#   height    = max(c1, railY)
#
# Why this shape: lifted() is the rail line raised by .CAMLIFT wherever the
# track slopes (the SYMMETRIC max makes it start rising just before a corner
# and flatten .CAMLIFT early -- the SAME both approaching and leaving, so a
# climb and a descent are treated identically). Averaging it over a
# +/-.CAMBLEND/2 window reproduces straight stretches EXACTLY -- level on
# flats, truly parallel at 45 degrees mid-slope, no lag -- while every corner
# becomes a parabolic blend exactly .CAMBLEND blocks long. So the camera
# lifts off shortly before a slope, is moving parallel as it arrives, rides
# it precisely, then decelerates and lands LEVEL exactly at the far height --
# never pinned to the 45, never kinked, never sunk below the rails, and
# floating .CAMLIFT above on the way down just as on the way up.
#
# STATELESS AND SYMMETRIC: the height is a pure function of the rig position
# and the fixed recorded profile -- no per-tick state, no travel-direction
# term -- so REVERSING retraces the exact path the ride took FORWARD over the
# same terrain. (The old design carried descents with a reactive exponential
# chaser eased by .CAMSMOOTH; that was the one stateful term, and it floated
# forward descents high while the reverse pass collapsed onto the bare rails
# and clipped the track -- the "reverse sinks into descents" report. Widening
# the max to a symmetric window lets c1 float descents by itself, so the
# chaser is gone and the two directions are identical.)
#
# All heights are in milliblocks. Column heights come from the history list
# appended by advance (storage infinite_rail:track y, index = X - .trackBase),
# read via the cam_get macro and interpolated by the pace cart's sub-block X
# so nothing is quantized to whole columns.

# No track history (pack updated over a ride in progress): leave the rig be.
execute unless data storage infinite_rail:track y[0] run return 0

# --- Pace-cart position -> rig column index .ci and sub-block fraction .fx ---
# Both derive from ONE fixed-point read (.cxm = X*1000) so they can never
# disagree about which column the cart is in; floorMod keeps the fraction
# correct west of X=0. The rig rides (.PACE_CART_BEHIND - .RIDER_BEHIND)
# columns ahead of the cart (both knobs measure from the build head).
execute store result score .cxm ir run data get entity @e[type=minecart,tag=ir_cart,limit=1] Pos[0] 1000
scoreboard players operation .fx ir = .cxm ir
scoreboard players operation .fx ir %= .C1000 ir
scoreboard players set .fi ir 1000
scoreboard players operation .fi ir -= .fx ir
scoreboard players operation .ci ir = .cxm ir
scoreboard players operation .ci ir -= .fx ir
scoreboard players operation .ci ir /= .C1000 ir
scoreboard players operation .ci ir -= .trackBase ir
scoreboard players operation .ci ir += .PACE_CART_BEHIND cfg_ride
scoreboard players operation .ci ir -= .RIDER_BEHIND cfg_camera
scoreboard players operation .cmaxi ir = .headX ir
scoreboard players operation .cmaxi ir -= .trackBase ir
execute if score .ci ir matches ..-1 run scoreboard players set .ci ir 0
execute if score .ci ir > .cmaxi ir run scoreboard players operation .ci ir = .cmaxi ir

# --- Precompute: .lift in milliblocks; .wmax = how far each lifted() sample
# scans ahead (further is pointless -- the +.CAMLIFT cap clips it anyway) ---
scoreboard players operation .lift ir = .CAMLIFT cfg_camera
scoreboard players operation .lift ir *= .C100 ir
scoreboard players operation .wmax ir = .CAMLIFT cfg_camera
scoreboard players operation .wmax ir /= .C10 ir
scoreboard players add .wmax ir 2

# --- The rail line right at the rig (floor + descent-chaser target) ---
scoreboard players operation .si ir = .ci ir
function infinite_rail:cam_sample
scoreboard players operation .linem ir = .sm ir

# --- c1: the S-curve -- average lifted() over the +/-.CAMBLEND/2 window ---
scoreboard players set .tsum ir 0
scoreboard players set .tn ir 0
scoreboard players operation .half ir = .CAMBLEND cfg_camera
scoreboard players operation .half ir /= .C2 ir
scoreboard players set .j ir 0
scoreboard players operation .j ir -= .half ir
function infinite_rail:cam_blend
scoreboard players operation .c1 ir = .tsum ir
scoreboard players operation .c1 ir /= .tn ir

# --- Final height: the S-curve, never below the rail line ---
# Just c1 now (a stateless function of position) floored at the rail line.
# The symmetric lifted() max means c1 already floats .CAMLIFT above the line
# on descents as well as climbs, so the old reactive descent chaser (.s2,
# eased by .CAMSMOOTH) is gone -- it was the one stateful term, and it made
# reverse sink onto the bare rails where forward floated high. Reverse now
# retraces forward exactly.
scoreboard players operation .sy ir = .c1 ir
execute if score .sy ir < .linem ir run scoreboard players operation .sy ir = .linem ir
function infinite_rail:cam_move
