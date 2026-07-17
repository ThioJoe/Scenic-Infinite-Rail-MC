# SYMMETRIC max scan for one cam_blend sample (recursive: .k advances by 1
# from -(.wmax+1) until it passes +.wmax). Tracks the highest interpolated
# profile height .fmx over [.cb-.wmax-1 .. .cb+.wmax] and captures the k = 0
# sample as .l0 (the rail line at the sample point, for the +.CAMLIFT cap).
# The max is symmetric -- it looks the same distance each way -- so a descent
# floats .CAMLIFT above the line exactly like a climb, and the whole height
# is a stateless function of position: reverse retraces forward. (An earlier
# forward-only scan [0 .. .wmax] let climbs lift but left descents to a
# stateful chaser, which is what made reverse sink onto the bare rails.)
scoreboard players operation .si ir = .cb ir
scoreboard players operation .si ir += .k ir
function infinite_rail:cam_sample
execute if score .sm ir > .fmx ir run scoreboard players operation .fmx ir = .sm ir
execute if score .k ir matches 0 run scoreboard players operation .l0 ir = .sm ir
scoreboard players add .k ir 1
execute if score .k ir <= .wmax ir run function infinite_rail:cam_scan
