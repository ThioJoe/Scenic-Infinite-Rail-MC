# SYMMETRIC maxLine scan, centered at the rig column .cb (recursive: .sk
# advances by 1 from -(.wmax+1) until it passes +.wmax). Each window position
# samples the PRE-SMOOTHED profile (cam_smooth, a +/-.srad box average around
# .sc) rather than the raw rail, so the concave ramp corners round off. Tracks
# .fmx, the highest sline over [.cb-.wmax-1 .. .cb+.wmax], and captures the
# .sk = 0 sample as .slinem -- sline at the rig (the base of the +.lift
# parallel line). The window reaches one column further WEST than east because
# cam_sample's pair-straddle reads one column east of each index, balancing it
# to an effectively symmetric span (climbs and descents identical; reverse
# retraces forward).
scoreboard players operation .sc ir = .cb ir
scoreboard players operation .sc ir += .sk ir
scoreboard players set .ssum ir 0
scoreboard players set .scnt ir 0
scoreboard players set .sj2 ir 0
scoreboard players operation .sj2 ir -= .srad ir
function infinite_rail:cam_smooth
scoreboard players operation .smv ir = .ssum ir
scoreboard players operation .smv ir /= .scnt ir
execute if score .smv ir > .fmx ir run scoreboard players operation .fmx ir = .smv ir
execute if score .sk ir matches 0 run scoreboard players operation .slinem ir = .smv ir
scoreboard players add .sk ir 1
execute if score .sk ir <= .wmax ir run function infinite_rail:cam_scan
