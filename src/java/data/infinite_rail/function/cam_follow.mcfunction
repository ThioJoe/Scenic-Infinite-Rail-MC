# Per-tick camera driver (see CONTEXT.md 7g). The rider sits -- permanently,
# mounted exactly once per ride -- in a real minecart (ir_ride) glued to the
# invisible camera seat (ir_seat), and this function flies that rig along a
# CONSTRUCTED path (.PACE_CART_BEHIND - .RIDER_BEHIND) blocks ahead of the hidden pace cart, built
# from the track's recorded profile:
#
#   lifted(i) = min( max of railY over [i-.cmw .. i+.cmw],  railY(i)+.cmlift )   (.cmw = lift columns)
#   height    = triangle_smooth( lifted )   floored at the RAW rail line
#
# ONE continuous operation. `lifted` is the ideal envelope -- level on flats
# (max == rail there, so the min is the rail), parallel +.CAMLIFT mid-slope,
# and it holds the flat OVER a convex top (a descent lip) with no vertical
# overshoot (.CAMLIFT is the clearance budget). It has hard corners; a single
# TRIANGLE-kernel convolution (weights .cmh-|j|, .cmh = .CAMBLEND/2, over
# cam_kernel) rounds them ALL at once into one smooth curve, so every ramp end
# -- top and bottom, climb and descent -- eases with the SAME shape and a
# horizontal tangent: launch level off the top, ride parallel, DECELERATE onto
# the flat at the bottom. No seam, no notch, no hard landing.
#
# Two things make it clean: the max window is +/-.cmw with .cmw = lift COLUMNS
# (.CAMLIFT/10) -- it looks exactly `lift` ahead, just enough to establish the
# float on a 45-degree slope (a wider window over-anticipates and bulges the
# ramp bottoms); and the floor is the RAW rail line, so flats stay exactly
# level and the rig never sinks into the track.
#
# STATELESS AND SYMMETRIC: the height is a pure function of the rig position
# and the fixed profile -- no time state, no travel-direction term -- so
# REVERSING retraces the exact forward path, and the symmetric windows treat a
# climb and a descent identically.
#
# All heights are in milliblocks. Column heights come from the history list
# (storage infinite_rail:track y, index = X - .trackBase), read via cam_get and
# interpolated by the pace cart's sub-block X. Every scratch score is
# camera-private (.cm* / the cam_* set) so nothing here can clobber the ride,
# speed or build logic.

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

# --- Precompute: .cmlift (milli); .cmw = max window = lift in columns;
# .cmh = triangle half-width (.CAMBLEND/2, min 1 -> a single tap = no ease);
# .cmhm = .cmh-1 = the kernel's outer offset. ---
scoreboard players operation .cmlift ir = .CAMLIFT cfg_camera
scoreboard players operation .cmlift ir *= .C100 ir
scoreboard players operation .cmw ir = .CAMLIFT cfg_camera
scoreboard players operation .cmw ir /= .C10 ir
scoreboard players operation .cmh ir = .CAMBLEND cfg_camera
scoreboard players operation .cmh ir /= .C2 ir
execute if score .cmh ir matches ..0 run scoreboard players set .cmh ir 1
scoreboard players operation .cmhm ir = .cmh ir
scoreboard players remove .cmhm ir 1

# --- The RAW rail line at the rig (the floor) ---
scoreboard players operation .si ir = .ci ir
function infinite_rail:cam_sample
scoreboard players operation .cmfloor ir = .sm ir

# --- Triangle-weighted convolution of lifted() over [-.cmhm .. .cmhm] ---
scoreboard players set .cmsum ir 0
scoreboard players set .cmden ir 0
scoreboard players set .cmj ir 0
scoreboard players operation .cmj ir -= .cmhm ir
function infinite_rail:cam_kernel
scoreboard players operation .sy ir = .cmsum ir
scoreboard players operation .sy ir /= .cmden ir

# --- Final height: never below the RAW rail line ---
execute if score .sy ir < .cmfloor ir run scoreboard players operation .sy ir = .cmfloor ir
function infinite_rail:cam_move
