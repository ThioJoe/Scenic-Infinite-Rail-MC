# Per-tick camera driver (see CONTEXT.md 7g). The rider sits -- permanently,
# mounted exactly once per ride -- in a real minecart (ir_ride) that is a
# passenger of the invisible camera seat (ir_seat), so cart, rider and camera
# move as one rigid unit and there are never any mount transitions. This
# function flies that rig along a pre-smoothed path #CAMAHEAD blocks ahead of
# the hidden pace cart (ir_cart), which rides the physical rails behind the
# viewer and sets the pace:
#
#   avg  = symmetric average of railY over [rigX-W .. rigX+W]  (W = #CAMWINDOW)
#   ty   = clamp(avg, >= railY at the rig, <= railY + 2)
#   rise -> follow immediately (the symmetric window starts climbs ~W blocks
#           BEFORE the corner -- a predictive S-curve -- and has ZERO lag on a
#           steady 45-degree run, so the rig rides exactly parallel to the
#           rail and can never sink into terrain)
#   fall -> ease by 1/#CAMSMOOTH per tick (the reactive descent glide)
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

# --- Scan the +/-#CAMWINDOW window (step 2): fills #csum/#cn (the average)
# and #linem (the rail line right at the rig) ---
scoreboard players set #csum ir 0
scoreboard players set #cn ir 0
scoreboard players set #k ir 0
scoreboard players operation #k ir -= #CAMWINDOW ir
# Force an even starting offset so the k=0 sample (the rail line) always lands.
scoreboard players operation #kk ir = #k ir
scoreboard players operation #kk ir %= #C2 ir
scoreboard players operation #k ir -= #kk ir
function infinite_rail:cam_scan

# --- Target height: the window average, never below the rail line, and never
# more than 2 blocks of S-curve bulge above it (tunnel-roof headroom) ---
scoreboard players operation #ty ir = #csum ir
scoreboard players operation #ty ir /= #cn ir
execute if score #ty ir < #linem ir run scoreboard players operation #ty ir = #linem ir
scoreboard players operation #t2 ir = #linem ir
scoreboard players add #t2 ir 2000
execute if score #ty ir > #t2 ir run scoreboard players operation #ty ir = #t2 ir

# --- Glide #sy toward #ty, then move the rig there ---
function infinite_rail:cam_glide
function infinite_rail:cam_move
