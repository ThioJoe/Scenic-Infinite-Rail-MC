# Forward-max scan for one cam_blend sample (recursive: .k advances by 2
# until it passes .wmax). Tracks the highest interpolated profile height
# .fmx over [.cb .. .cb+.wmax+1] and captures the k = 0 sample as .l0 (the
# rail line at the sample point).
scoreboard players operation .si ir = .cb ir
scoreboard players operation .si ir += .k ir
function infinite_rail:cam_sample
execute if score .sm ir > .fmx ir run scoreboard players operation .fmx ir = .sm ir
execute if score .k ir matches 0 run scoreboard players operation .l0 ir = .sm ir
scoreboard players add .k ir 1
execute if score .k ir <= .wmax ir run function infinite_rail:cam_scan
