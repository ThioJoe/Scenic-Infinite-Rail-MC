# Invisible track's just-in-time rail strip (mode_hidetrack_* / .HIDETRACK,
# CONTEXT 6.9): the builder skips the visible rail + support on invisible
# columns, but the hidden pace cart is a REAL minecart that physically needs
# powered rails -- so this keeper rolls a short strip of track along
# beneath it: the window [cartX-2 .. cartX+8] is kept placed, and columns
# that fall out of it (either edge -- the ride can also run backwards at
# negative speeds) are wiped again. The strip lives (.PACE_CART_BEHIND -
# .RIDER_BEHIND) blocks behind the viewer, right where the (already visible
# when looking back) pace cart is, so it is never in the rider's view.
# Which columns it may touch is the per-column track v list (0 = built
# invisible; appended by advance beside the y history): columns built
# VISIBLE (v 1, or predating the list) are never placed over or wiped, so
# the strip glides across mode boundaries without eating real track.
# Called from main (each ride tick), launch_tick (the runway pre-build) and
# once from begin (the first column must carry the cart the tick it is
# summoned). Cost: gated to nothing until the first invisible column ever
# exists (.stpAny), then a handful of storage reads per cart block crossed
# (idempotent re-placement: a setblock onto an identical block is a no-op).

# Never any invisible columns in this ride -> free.
execute unless score .stpAny ir matches 1 run return 0
# No recorded centerline (upgraded save mid-ride): nothing safe to place.
execute unless score .lineZ ir = .lineZ ir run return 0
# No selectable pace cart (unloaded/vanished -- the watchdog is on it): hold
# the strip where it is. A garbage .cartX (a failed store writes 0) must not
# drag the window across the world.
execute unless entity @e[type=minecart,tag=ir_cart,limit=1] run return 0

# Due? Only when the cart crossed into a new block column -- plus a 20-tick
# retry clock, so a setblock that failed into a not-yet-loaded chunk (or a
# stall that froze .cartX) self-heals without waiting for cart movement.
scoreboard players add .stpT ir 1
execute if score .cartX ir = .stpAt ir if score .stpT ir matches ..19 run return 0
scoreboard players set .stpT ir 0
scoreboard players operation .stpAt ir = .cartX ir

# The wanted window [cartX-2 .. cartX+8], clamped to the remembered track
# [trackBase .. headX]. +8 ahead outruns the fastest per-tick cart travel
# with margin; -2 behind keeps the cart itself (and its settling wobble)
# safely inside the placed span.
scoreboard players operation .stpA ir = .cartX ir
scoreboard players remove .stpA ir 2
execute if score .stpA ir < .trackBase ir run scoreboard players operation .stpA ir = .trackBase ir
scoreboard players operation .stpZ ir = .cartX ir
scoreboard players add .stpZ ir 8
execute if score .stpZ ir > .headX ir run scoreboard players operation .stpZ ir = .headX ir
execute if score .stpZ ir < .stpA ir run scoreboard players operation .stpZ ir = .stpA ir

# First use: seed the placed-range pointers at the window (nothing placed yet).
execute unless score .stpLo ir = .stpLo ir run scoreboard players operation .stpLo ir = .stpA ir
execute unless score .stpHi ir = .stpHi ir run scoreboard players operation .stpHi ir = .stpZ ir

# One shared work budget for both clearing walks (a watchdog recovery can
# jump the cart many columns at once; leftovers resume next tick).
scoreboard players set .stpB ir 24

# West edge: wipe columns that fell out the back (normal eastward travel).
function infinite_rail:strip_back
# A backward cart jump re-anchors without wiping -- the columns between are
# re-placed by the ensure walk below as the window covers them again.
execute if score .stpLo ir > .stpA ir run scoreboard players operation .stpLo ir = .stpA ir

# East edge: wipe columns that fell out the front (reverse travel).
function infinite_rail:strip_front
execute if score .stpHi ir < .stpZ ir run scoreboard players operation .stpHi ir = .stpZ ir

# Ensure the whole window is placed. Idempotent: an already-placed column's
# setblocks fail silently against the identical blocks.
scoreboard players operation .stpX ir = .stpA ir
function infinite_rail:strip_fwd
