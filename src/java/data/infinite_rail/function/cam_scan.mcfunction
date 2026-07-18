# SYMMETRIC maxRail scan, centered at the rig column .cb (recursive: .sk
# advances by 1 from -(.wmax+1) until it passes +.wmax). Tracks .fmx, the
# highest interpolated rail over [.cb-.wmax-1 .. .cb+.wmax], and captures the
# .sk = 0 sample as .linem -- the rig's own rail line (the floor, and the base
# the parallel .lift line is measured from). The window reaches one column
# further WEST than east because cam_sample's pair-straddle reads one column
# EAST of each nominal index, which balances it to an effectively symmetric
# span -- so a climb and a descent are treated identically and the whole height
# stays a stateless function of position (reverse retraces forward).
scoreboard players operation .si ir = .cb ir
scoreboard players operation .si ir += .sk ir
function infinite_rail:cam_sample
execute if score .sm ir > .fmx ir run scoreboard players operation .fmx ir = .sm ir
execute if score .sk ir matches 0 run scoreboard players operation .linem ir = .sm ir
scoreboard players add .sk ir 1
execute if score .sk ir <= .wmax ir run function infinite_rail:cam_scan
