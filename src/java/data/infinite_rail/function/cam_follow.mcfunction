# Per-tick camera driver (see CONTEXT.md 7g). The rider sits -- permanently,
# mounted exactly once per ride -- in a real minecart (ir_ride) glued to the
# invisible camera seat (ir_seat), and this function flies that rig along a
# CONSTRUCTED S-curve (.PACE_CART_BEHIND - .RIDER_BEHIND) blocks ahead of the hidden pace cart, built
# from the track's recorded profile:
#
#   lifted(x) = min( max of railY over [x .. x+.CAMLIFT+2],  railY(x)+.CAMLIFT )
#   c1(x)     = average of lifted() over [x-.CAMBLEND/2 .. x+.CAMBLEND/2]
#   c2       += (railY - c2) / .CAMSMOOTH          (reactive descent chaser)
#   height    = max(c1, c2, railY)
#
# Why this shape: lifted() is the rail line raised by .CAMLIFT wherever the
# track climbs (the small forward max makes it start rising just before a
# climb corner and flatten at the summit level .CAMLIFT early). Averaging it
# over a +/-.CAMBLEND/2 window reproduces straight stretches EXACTLY -- level
# on flats, truly parallel at 45 degrees mid-climb, no lag, no exponential
# tail -- while every corner becomes a parabolic blend exactly .CAMBLEND
# blocks long. So the camera lifts off shortly before a climb, is moving
# parallel with the track as the slope arrives, rides it precisely, then
# decelerates and lands LEVEL exactly at the summit height -- never pinned to
# the 45 and kinked over the crest, and never sunk below the rails. Descents
# are left to c2, the same reactive exponential glide as always (on the way
# down the forward max IS the current line, so c1 hugs it and c2 wins the
# max). The blend length does NOT scale with slope size: between blends the
# camera simply rides parallel, however long the climb.
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

# --- c2: the reactive descent chaser (eases toward the line; floats above it
# while the line drops away, converges and holds on flats) ---
scoreboard players operation .dy ir = .linem ir
scoreboard players operation .dy ir -= .s2 ir
scoreboard players operation .dy ir /= .CAMSMOOTH cfg_camera
scoreboard players operation .s2 ir += .dy ir

# --- Final height: the higher of the two curves, never below the rail line ---
scoreboard players operation .sy ir = .c1 ir
execute if score .s2 ir > .sy ir run scoreboard players operation .sy ir = .s2 ir
execute if score .sy ir < .linem ir run scoreboard players operation .sy ir = .linem ir
function infinite_rail:cam_move
