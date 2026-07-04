# Per-tick hybrid camera driver (see CONTEXT.md 7g). The rider sits in the
# REAL minecart wherever the track is flat -- native cart feel, perfectly in
# sync with the cart model -- and is switched onto the invisible camera seat
# only around elevation changes, where the seat flies a pre-smoothed S-curve
# computed from the track's own recorded profile:
#
#   avg  = symmetric average of railY over [cartX-W .. cartX+W]  (W = #CAMWINDOW)
#   ty   = max(avg, railY at the cart) + seatBase + #CAMHEIGHT
#   rise -> follow immediately (the symmetric window starts the climb ~W blocks
#           BEFORE the corner: the predictive S-curve; and it has ZERO lag on a
#           steady 45-degree run, so the camera rides exactly parallel to the
#           rail -- the cart can never tilt up into the view and the rider can
#           never sag down into blocks)
#   fall -> ease by 1/#CAMSMOOTH per tick (the reactive descent glide)
#
# The max() clamp means the camera never goes below the rail line, so climb
# corners bulge gently UP and over (capped at 2 blocks) while descent corners
# are handled by the reactive glide -- both stay in carved air. All heights
# are in milliblocks. Column heights come from the history list appended by
# advance (storage infinite_rail:track y, index = X - #trackBase), read via
# the cam_get macro and interpolated by the cart's sub-block X so nothing is
# quantized to whole columns.

# No track history (pack updated over a ride in progress): plain cart riding.
execute unless data storage infinite_rail:track y[0] run return 0

# --- Cart position -> column index #ci and sub-block fraction #fx ---
# Both are derived from ONE fixed-point read (#cxm = X*1000) so they can never
# disagree about which column the cart is in. floorMod keeps the fraction
# correct west of X=0 too.
execute store result score #cxm ir run data get entity @e[type=minecart,tag=ir_cart,limit=1] Pos[0] 1000
scoreboard players operation #fx ir = #cxm ir
scoreboard players operation #fx ir %= #C1000 ir
scoreboard players set #fi ir 1000
scoreboard players operation #fi ir -= #fx ir
scoreboard players operation #ci ir = #cxm ir
scoreboard players operation #ci ir -= #fx ir
scoreboard players operation #ci ir /= #C1000 ir
scoreboard players operation #ci ir -= #trackBase ir
scoreboard players operation #cmaxi ir = #headX ir
scoreboard players operation #cmaxi ir -= #trackBase ir
execute if score #ci ir matches ..-1 run scoreboard players set #ci ir 0
execute if score #ci ir > #cmaxi ir run scoreboard players operation #ci ir = #cmaxi ir

# --- Scan the +/-#CAMWINDOW window (step 2): fills #csum/#cn (average),
# #cmin/#cmax (flatness detection) and #linem (rail height at the cart) ---
scoreboard players set #csum ir 0
scoreboard players set #cn ir 0
scoreboard players set #cmin ir 99999
scoreboard players set #cmax ir -99999
scoreboard players set #k ir 0
scoreboard players operation #k ir -= #CAMWINDOW ir
# Force an even starting offset so the k=0 sample (the rail line) always lands.
scoreboard players operation #kk ir = #k ir
scoreboard players operation #kk ir %= #C2 ir
scoreboard players operation #k ir -= #kk ir
function infinite_rail:cam_scan

# --- One-time calibration: with the rail flat right under the cart (#flat0)
# and the rider seated in it, measure how high a cart passenger actually sits
# above the rail line. Seat mode reproduces exactly that eye height
# (#CAMHEIGHT 0 = "in the cart").
execute if score #sbOk ir matches 0 if score #flat0 ir matches 1 as @a[gamemode=adventure,limit=1] if data entity @s RootVehicle run function infinite_rail:cam_base
execute if score #sbOk ir matches 0 run return 0

# --- Target height: clamped window average + seat offset ---
scoreboard players operation #avgm ir = #csum ir
scoreboard players operation #avgm ir /= #cn ir
execute if score #avgm ir < #linem ir run scoreboard players operation #avgm ir = #linem ir
scoreboard players operation #ty ir = #avgm ir
scoreboard players operation #ty ir += #seatBase ir
scoreboard players operation #t2 ir = #CAMHEIGHT ir
scoreboard players operation #t2 ir *= #C100 ir
scoreboard players operation #ty ir += #t2 ir
# Headroom guard: cap the S-curve bulge at 2 blocks above the rail line, so a
# climb entry inside a tunnel can't lift the rider's head into the bore roof.
scoreboard players operation #t2 ir += #linem ir
scoreboard players operation #t2 ir += #seatBase ir
scoreboard players add #t2 ir 2000
execute if score #ty ir > #t2 ir run scoreboard players operation #ty ir = #t2 ir

# --- Mode: seat only around elevation changes (or while the glide is still
# settling back to parity); the real cart everywhere else ---
scoreboard players set #wantSeat ir 0
execute unless score #cmin ir = #cmax ir run scoreboard players set #wantSeat ir 1
scoreboard players operation #dy ir = #ty ir
scoreboard players operation #dy ir -= #sy ir
execute unless score #dy ir matches -60..60 run scoreboard players set #wantSeat ir 1
# #CAMWINDOW 0 (or less) = camera system off: force cart mode. The rig still
# gets moved below so it keeps traveling with the ride.
execute if score #CAMWINDOW ir matches ..0 run scoreboard players set #wantSeat ir 0

# Cart mode: hand the rider back if due, park the glide state at parity.
execute if score #wantSeat ir matches 0 if score #onSeat ir matches 1 run function infinite_rail:cam_to_cart
execute if score #wantSeat ir matches 0 run scoreboard players operation #sy ir = #ty ir

# Seat mode: take the rider over if due, then glide #sy toward #ty.
execute if score #wantSeat ir matches 1 if score #onSeat ir matches 0 run function infinite_rail:cam_to_seat
execute if score #wantSeat ir matches 1 run function infinite_rail:cam_glide

# Move the seat along (every tick, in BOTH modes: it carries the plug in cart
# mode and must travel with the ride, or it would be left behind and unload).
function infinite_rail:cam_move
