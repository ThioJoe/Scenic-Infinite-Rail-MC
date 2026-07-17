# One S-curve sample: computes lifted() at column offset .j from the rig and
# adds it to the blend average (recursive: .j advances by 1 until it passes
# +.CAMBLEND/2).
#
#   lifted = min( max of the profile over [j-.wmax-1 .. j+.wmax],  line(j) + .lift )
#
# The SYMMETRIC max makes the value start rising just before a slope corner
# and flatten at the far level .CAMLIFT early, the same approaching or
# leaving; the cap keeps it a constant .CAMLIFT above the rail mid-slope --
# so descents float exactly like climbs and the curve is a stateless function
# of position (reverse retraces forward).
scoreboard players operation .cb ir = .ci ir
scoreboard players operation .cb ir += .j ir
scoreboard players set .fmx ir -2000000000
# The scan is symmetric: start .wmax+1 columns WEST of the sample (cam_scan
# walks up to +.wmax east). A descent then floats .CAMLIFT above the line
# just like a climb, and the curve is a stateless function of position.
scoreboard players set .k ir 0
scoreboard players operation .k ir -= .wmax ir
scoreboard players remove .k ir 1
function infinite_rail:cam_scan
scoreboard players operation .tj ir = .l0 ir
scoreboard players operation .tj ir += .lift ir
execute if score .fmx ir < .tj ir run scoreboard players operation .tj ir = .fmx ir
scoreboard players operation .tsum ir += .tj ir
scoreboard players add .tn ir 1
scoreboard players add .j ir 1
execute if score .j ir <= .half ir run function infinite_rail:cam_blend
