# Running flat: begin a climb/descent only if BOTH hold:
#   1. the target is at least .DEADBAND blocks away (ignore small terrain noise), and
#   2. enough flat distance has passed since the last event --
#        .SAMEGAP columns to slope again in the SAME direction, or
#        .TURNGAP columns to reverse direction.
# If a change is wanted but a gap forbids it, we hold the current height. That
# is deliberate: terrain rising into us then becomes a tunnel ("punch through
# instead of going over it") and terrain dropping away becomes a bridge
# ("build a bridge instead of going down").

scoreboard players set .want ir 0
execute if score .diff ir >= .DEADBAND ir run scoreboard players set .want ir 1
scoreboard players set .ndead ir 0
scoreboard players operation .ndead ir -= .DEADBAND ir
execute if score .diff ir <= .ndead ir run scoreboard players set .want ir -1

# --- Ground-contact overrides (the near scan; see decide's guard block) ---
# Climb EARLY: the level line is about to plow into terrain within .UPLOOK
# blocks (.gmax above the rail) and the average confirms rising ground
# (.diff >= 1): want the climb even inside the deadband, instead of tunneling
# in and climbing late. The spacing gaps below still have the final say.
execute unless score .SKYMODE ir matches 1 if score .UPLOOK ir matches 1.. if score .want ir matches 0 if score .diff ir matches 1.. if score .gmax ir > .railY ir run scoreboard players set .want ir 1
# Descend LATE: never START a descent that would dig -- if there is not room
# for even two steps above the near ground (.dig2, from decide), hold the
# level and let the ground fall away first. The descent then begins at the
# drop-off and glides down in open air, rather than trenching down through
# the ground to get a head start.
execute unless score .want ir matches 0.. if score .dig2 ir matches 1 run scoreboard players set .want ir 0

# No change wanted: stay flat and keep counting toward the next gap.
execute if score .want ir matches 0 run scoreboard players add .flat ir 1

# Change wanted: required gap is .SAMEGAP to repeat the last direction, else .TURNGAP.
execute unless score .want ir matches 0 if score .want ir = .lastDir ir run scoreboard players operation .need ir = .SAMEGAP ir
execute unless score .want ir matches 0 unless score .want ir = .lastDir ir run scoreboard players operation .need ir = .TURNGAP ir

# Enough distance -> start the event; otherwise hold (tunnel/bridge) and keep
# counting. The .slope guard skips the increment when start_event just fired
# (it sets .slope nonzero and zeroes .flat).
execute unless score .want ir matches 0 if score .flat ir >= .need ir run function ir_start_event
execute unless score .want ir matches 0 if score .slope ir matches 0 run scoreboard players add .flat ir 1
