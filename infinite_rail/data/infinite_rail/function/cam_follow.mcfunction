# Per-tick camera driver (see CONTEXT.md 7g). The rider sits -- permanently,
# mounted exactly once per ride -- in a real minecart (ir_ride) that is a
# passenger of the invisible camera seat (ir_seat), so cart, rider and camera
# move as one rigid unit and there are never any mount transitions. This
# function flies that rig along a pre-smoothed path #CAMAHEAD blocks ahead of
# the hidden pace cart (ir_cart), which rides the physical rails behind the
# viewer and sets the pace:
#
#   ty = min( max of railY over [rigX .. rigX+W],  railY + #CAMLIFT )
#   sy += (ty - sy) / #CAMSMOOTH        (the same ease in BOTH directions)
#   sy = max(sy, railY)                 (never below the rail line)
#
# The forward-max target is what makes climbs feel like descents played in
# reverse: a descent is an exponential ease toward a line that drops away
# ahead; a climb becomes an exponential ease toward a target that RISES ahead
# of the corner (the max sees the hill #CAMWINDOW blocks early). The camera
# lifts off before the slope, floats at most #CAMLIFT above the rail while
# climbing, and -- because the target reaches the summit level #CAMLIFT
# blocks before the rail does -- decelerates and lands level on the hilltop
# instead of being pinned to the full 45-degree line and kinking over the
# crest. On flats the target equals the line exactly (parked); on descents
# the max of what's ahead IS the current line, so the reactive drop-glide is
# unchanged.
#
# All heights are in milliblocks. Column heights come from the history list
# appended by advance (storage infinite_rail:track y, index = X - #trackBase),
# read via the cam_get macro and interpolated by the pace cart's sub-block X
# so nothing is quantized to whole columns.

# No track history (pack updated over a ride in progress): leave the rig be.
execute unless data storage infinite_rail:track y[0] run return 0

# --- Pace-cart position -> rig column index #ci and sub-block fraction #fx ---
# Both derive from ONE fixed-point read (#cxm = X*1000) so they can never
# disagree about which column the cart is in; floorMod keeps the fraction
# correct west of X=0. The rig rides #CAMAHEAD columns ahead of the cart.
execute store result score #cxm ir run data get entity @e[type=minecart,tag=ir_cart,limit=1] Pos[0] 1000
scoreboard players operation #fx ir = #cxm ir
scoreboard players operation #fx ir %= #C1000 ir
scoreboard players set #fi ir 1000
scoreboard players operation #fi ir -= #fx ir
scoreboard players operation #ci ir = #cxm ir
scoreboard players operation #ci ir -= #fx ir
scoreboard players operation #ci ir /= #C1000 ir
scoreboard players operation #ci ir -= #trackBase ir
scoreboard players operation #ci ir += #CAMAHEAD ir
scoreboard players operation #cmaxi ir = #headX ir
scoreboard players operation #cmaxi ir -= #trackBase ir
execute if score #ci ir matches ..-1 run scoreboard players set #ci ir 0
execute if score #ci ir > #cmaxi ir run scoreboard players operation #ci ir = #cmaxi ir

# --- Scan the profile from the rig to +#CAMWINDOW ahead (step 2): fills
# #fmx (the forward maximum) and #linem (the rail line right at the rig) ---
scoreboard players set #fmx ir -2000000000
scoreboard players set #k ir 0
function infinite_rail:cam_scan

# --- Target height: the forward max, capped #CAMLIFT above the rail line.
# The k=0 sample is included in the max, so #fmx (and thus #ty) can never be
# below the line. ---
scoreboard players operation #ty ir = #CAMLIFT ir
scoreboard players operation #ty ir *= #C100 ir
scoreboard players operation #ty ir += #linem ir
execute if score #fmx ir < #ty ir run scoreboard players operation #ty ir = #fmx ir

# --- Glide #sy toward #ty, then move the rig there ---
function infinite_rail:cam_glide
function infinite_rail:cam_move
