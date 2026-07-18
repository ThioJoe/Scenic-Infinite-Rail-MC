# Per-tick camera driver (see CONTEXT.md 7g). The rider sits -- permanently,
# mounted exactly once per ride -- in a real minecart (ir_ride) glued to the
# invisible camera seat (ir_seat), and this function flies that rig along a
# CONSTRUCTED path (.PACE_CART_BEHIND - .RIDER_BEHIND) blocks ahead of the hidden pace cart, built
# from the track's recorded profile:
#
#   maxRail = max of railY over [x-.wmax-1 .. x+.wmax]     (the SYMMETRIC window)
#   c1(x)   = softmin( maxRail,  railY(x)+.lift,  .kw )
#   height  = max(c1, railY)
#
# Why this shape: the two lines the camera is built from are the "higher
# ground" line maxRail (the flat/crest the camera rides toward -- it rises just
# before a slope) and the parallel line railY+.lift (exactly .CAMLIFT above the
# rail). Their lower envelope min(maxRail, railY+.lift) is the ideal path:
# level on flats (maxRail == railY there), parallel +.lift mid-slope, and it
# holds the flat OVER a convex top (a descent lip) with NO vertical overshoot
# -- .CAMLIFT is the clearance budget. A SOFT-min rounds the hard corner where
# those two lines cross WITHOUT cutting below it, so a descent launches off the
# lip with a HORIZONTAL tangent and eases onto the parallel line instead of
# kinking down into the rail. .CAMBLEND sets how long that ease is (.kw = the
# corner half-width). A final floor at railY keeps the rig off the track.
#
# The old box-average smoothing did this WRONG: a mean is one-sided -- it cut
# convex corners (a descent top) DOWN while filling concave ones (the bottom)
# UP, so the floor turned the cut into a notch that hugged the descending rail
# for ~0.2 block right at the lip (the "bump"/clip at descent tops, Java only
# because Java teleports the seat to the exact height each tick while Bedrock's
# velocity-driven rig smeared it away). The soft-min rounds both corner
# directions the same and never undershoots the envelope.
#
# STATELESS AND SYMMETRIC: the height is a pure function of the rig position
# and the fixed recorded profile -- no per-tick state, no travel-direction
# term -- so REVERSING retraces the exact path the ride took FORWARD over the
# same terrain. The symmetric maxRail window treats a climb and a descent
# identically.
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

# --- Precompute: .lift in milliblocks; .wmax = how far the maxRail scan looks
# each way (further is pointless -- the +.CAMLIFT cap clips it anyway);
# .kw = the soft-min corner half-width in milliblocks, from .CAMBLEND
# (CAMBLEND*1000/4, e.g. 6 -> 1500 milli = 1.5 blocks). ---
scoreboard players operation .lift ir = .CAMLIFT cfg_camera
scoreboard players operation .lift ir *= .C100 ir
scoreboard players operation .wmax ir = .CAMLIFT cfg_camera
scoreboard players operation .wmax ir /= .C10 ir
scoreboard players add .wmax ir 2
scoreboard players operation .kw ir = .CAMBLEND cfg_camera
scoreboard players operation .kw ir *= .C1000 ir
scoreboard players operation .kw ir /= .C2 ir
scoreboard players operation .kw ir /= .C2 ir

# --- maxRail scan centered at the rig: .fmx = highest interpolated rail over
# the symmetric window [.ci-.wmax-1 .. .ci+.wmax]; .linem = the rig's own rail
# line (the .sk = 0 sample -- the floor, and the base of the parallel line). ---
scoreboard players operation .cb ir = .ci ir
scoreboard players set .fmx ir -2000000000
scoreboard players set .sk ir 0
scoreboard players operation .sk ir -= .wmax ir
scoreboard players remove .sk ir 1
function infinite_rail:cam_scan

# --- c1 = softmin( .fmx, .linem+.lift, .kw ): the rounded lower envelope ---
# softmin(a,b,k) = min(a,b) - max(k-|a-b|,0)^2 / (4k)  -- rounds the corner
# where a and b cross, staying at or below min(a,b) by up to k/4, and equal to
# min(a,b) once they are more than k apart. Integer-safe: h^2 <= k^2 fits, and
# the term is only computed when h >= 1 (which also guarantees 4k > 0).
scoreboard players operation .b ir = .linem ir
scoreboard players operation .b ir += .lift ir
# m = min(.fmx, .b)
scoreboard players operation .smm ir = .fmx ir
execute if score .b ir < .smm ir run scoreboard players operation .smm ir = .b ir
# d = |.fmx - .b|
scoreboard players operation .smd ir = .fmx ir
scoreboard players operation .smd ir -= .b ir
scoreboard players set .smt ir 0
scoreboard players operation .smt ir -= .smd ir
execute if score .smd ir matches ..-1 run scoreboard players operation .smd ir = .smt ir
# h = max(.kw - d, 0)
scoreboard players operation .smh ir = .kw ir
scoreboard players operation .smh ir -= .smd ir
execute if score .smh ir matches ..-1 run scoreboard players set .smh ir 0
# term = h*h / (4*.kw)   (guarded on h>=1, so .kw>=1 and 4k>0)
scoreboard players set .smt ir 0
execute if score .smh ir matches 1.. run scoreboard players operation .smt ir = .smh ir
execute if score .smh ir matches 1.. run scoreboard players operation .smt ir *= .smh ir
scoreboard players operation .sm4k ir = .kw ir
scoreboard players operation .sm4k ir *= .C2 ir
scoreboard players operation .sm4k ir *= .C2 ir
execute if score .smh ir matches 1.. run scoreboard players operation .smt ir /= .sm4k ir
# c1 = m - term
scoreboard players operation .c1 ir = .smm ir
scoreboard players operation .c1 ir -= .smt ir

# --- Final height: the soft-min curve, never below the rail line ---
scoreboard players operation .sy ir = .c1 ir
execute if score .sy ir < .linem ir run scoreboard players operation .sy ir = .linem ir
function infinite_rail:cam_move
