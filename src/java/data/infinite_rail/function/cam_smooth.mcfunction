# Pre-smooth the rail profile: accumulate cam_sample over the box window
# [.sc-.srad .. .sc+.srad] into .ssum/.scnt (recursive over .sj2). The caller
# (cam_scan) divides .ssum/.scnt to get sline at .sc. Averaging a constant or a
# straight line returns it unchanged, so this only rounds the profile's corners
# -- which is what turns the concave ramp ends (descent/ascent bottoms) into a
# horizontal-tangent landing instead of a hard edge. .srad 0 => one raw sample.
scoreboard players operation .si ir = .sc ir
scoreboard players operation .si ir += .sj2 ir
function infinite_rail:cam_sample
scoreboard players operation .ssum ir += .sm ir
scoreboard players add .scnt ir 1
scoreboard players add .sj2 ir 1
execute if score .sj2 ir <= .srad ir run function infinite_rail:cam_smooth
