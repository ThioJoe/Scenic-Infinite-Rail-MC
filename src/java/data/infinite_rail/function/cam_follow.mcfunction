# Per-tick camera driver (see CONTEXT.md 7g). The rider sits -- permanently,
# mounted exactly once per ride -- in a real minecart (ir_ride) glued to the
# invisible camera seat (ir_seat), and this function flies that rig along a
# CONSTRUCTED path (.PACE_CART_BEHIND - .RIDER_BEHIND) blocks ahead of the hidden pace cart, built
# from the track's recorded profile:
#
#   sline(i) = railY PRE-SMOOTHED over [i-.srad .. i+.srad]   (a box average)
#   maxLine  = max of sline over the SYMMETRIC [i-.wmax-1 .. i+.wmax] window
#   c1(x)    = softmin( maxLine,  sline(x)+.lift,  .kw )
#   height   = max(c1, railY(x))        (floored at the RAW rail line)
#
# Why this shape: the camera is the rounded lower envelope of the "higher
# ground" line maxLine (the flat/crest it rides toward, rising just before a
# slope) and the parallel line sline+.lift (exactly .CAMLIFT above the rail).
# A ramp has TWO kinds of corner and both must ease with a HORIZONTAL tangent:
#   * CONVEX corners (a descent top / ascent top) are where maxLine and
#     sline+.lift CROSS -- the softmin rounds that crossing WITHOUT cutting
#     below it, so the camera launches off the lip level and eases onto the
#     slope (no notch, no rail-hug, no vertical overshoot -- .CAMLIFT is the
#     clearance budget);
#   * CONCAVE corners (a descent bottom / ascent bottom) are the lines' OWN
#     kinks (maxLine's rolling-max edge, and sline+.lift where the rail
#     flattens) -- PRE-SMOOTHING the profile rounds those, so the camera
#     DECELERATES onto the flat instead of riding a hard edge down and slamming
#     level (the "upside-down"/vertical-lift bottom a bare soft-min leaves).
# The final floor is the RAW rail line, so flats stay exactly level and the rig
# never sinks into the track. .CAMLIFT sets the float height + scan reach;
# .CAMBLEND sets the corner ease -- .kw (soft-min half-width) and .srad
# (pre-smooth radius) both come from it.
#
# STATELESS AND SYMMETRIC: the height is a pure function of the rig position
# and the fixed recorded profile -- no per-tick state, no travel-direction
# term -- so REVERSING retraces the exact path the ride took FORWARD, and the
# symmetric windows treat a climb and a descent identically.
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

# --- Precompute: .lift (milli); .wmax (maxLine scan reach); .kw (soft-min
# corner half-width, .CAMBLEND*1000/4 milli); .srad (pre-smooth radius,
# round(.CAMBLEND/4) = (.CAMBLEND+2)/4 columns). .CAMBLEND 0 => .srad 0 / .kw 0
# = a hard corner (the raw min-envelope, no ease). ---
scoreboard players operation .lift ir = .CAMLIFT cfg_camera
scoreboard players operation .lift ir *= .C100 ir
scoreboard players operation .wmax ir = .CAMLIFT cfg_camera
scoreboard players operation .wmax ir /= .C10 ir
scoreboard players add .wmax ir 2
scoreboard players operation .kw ir = .CAMBLEND cfg_camera
scoreboard players operation .kw ir *= .C1000 ir
scoreboard players operation .kw ir /= .C2 ir
scoreboard players operation .kw ir /= .C2 ir
scoreboard players operation .srad ir = .CAMBLEND cfg_camera
scoreboard players add .srad ir 2
scoreboard players operation .srad ir /= .C2 ir
scoreboard players operation .srad ir /= .C2 ir

# --- The RAW rail line at the rig (the floor) ---
scoreboard players operation .si ir = .ci ir
function infinite_rail:cam_sample
scoreboard players operation .linem ir = .sm ir

# --- maxLine scan over the symmetric window, on the SMOOTHED profile:
# .fmx = highest sline, .slinem = sline at the rig (the parallel line's base) ---
scoreboard players operation .cb ir = .ci ir
scoreboard players set .fmx ir -2000000000
scoreboard players set .sk ir 0
scoreboard players operation .sk ir -= .wmax ir
scoreboard players remove .sk ir 1
function infinite_rail:cam_scan

# --- c1 = softmin( .fmx, .slinem+.lift, .kw ): the rounded lower envelope ---
# softmin(a,b,k) = min(a,b) - max(k-|a-b|,0)^2 / (4k). Integer-safe: h^2 <= k^2
# fits, and the term is only computed when h >= 1 (so 4k > 0).
scoreboard players operation .b ir = .slinem ir
scoreboard players operation .b ir += .lift ir
scoreboard players operation .smm ir = .fmx ir
execute if score .b ir < .smm ir run scoreboard players operation .smm ir = .b ir
scoreboard players operation .smd ir = .fmx ir
scoreboard players operation .smd ir -= .b ir
scoreboard players set .smt ir 0
scoreboard players operation .smt ir -= .smd ir
execute if score .smd ir matches ..-1 run scoreboard players operation .smd ir = .smt ir
scoreboard players operation .smh ir = .kw ir
scoreboard players operation .smh ir -= .smd ir
execute if score .smh ir matches ..-1 run scoreboard players set .smh ir 0
scoreboard players set .smt ir 0
execute if score .smh ir matches 1.. run scoreboard players operation .smt ir = .smh ir
execute if score .smh ir matches 1.. run scoreboard players operation .smt ir *= .smh ir
scoreboard players operation .sm4k ir = .kw ir
scoreboard players operation .sm4k ir *= .C2 ir
scoreboard players operation .sm4k ir *= .C2 ir
execute if score .smh ir matches 1.. run scoreboard players operation .smt ir /= .sm4k ir
scoreboard players operation .c1 ir = .smm ir
scoreboard players operation .c1 ir -= .smt ir

# --- Final height: the soft-min curve, never below the RAW rail line ---
scoreboard players operation .sy ir = .c1 ir
execute if score .sy ir < .linem ir run scoreboard players operation .sy ir = .linem ir
function infinite_rail:cam_move
