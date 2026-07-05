# One S-curve sample: computes lifted() at column offset .j from the rig and
# adds it to the blend average (recursive: .j advances by 2 until it passes
# +.CAMBLEND/2).
#
#   lifted = min( max of the profile over [j .. j+.wmax+1],  line(j) + .lift )
#
# The small forward max makes the value start rising just before a climb and
# flatten at the summit level .CAMLIFT early; the cap keeps it a constant
# .CAMLIFT above the rail mid-climb.
scoreboard players operation .cb ir = .ci ir
scoreboard players operation .cb ir += .j ir
scoreboard players set .fmx ir -2000000000
scoreboard players set .k ir 0
function infinite_rail:cam_scan
scoreboard players operation .tj ir = .l0 ir
scoreboard players operation .tj ir += .lift ir
execute if score .fmx ir < .tj ir run scoreboard players operation .tj ir = .fmx ir
scoreboard players operation .tsum ir += .tj ir
scoreboard players add .tn ir 1
scoreboard players add .j ir 1
execute if score .j ir <= .half ir run function infinite_rail:cam_blend
