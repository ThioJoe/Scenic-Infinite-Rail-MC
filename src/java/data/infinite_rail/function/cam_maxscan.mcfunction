# The rolling-max scan for cam_maxlift (recursive: .cmk runs from -.cmw to
# +.cmw). Tracks .cmmx, the highest interpolated rail over
# [.cmctr-.cmw .. .cmctr+.cmw], and captures the .cmk = 0 sample as .cmr -- the
# rail at .cmctr (the base of the +.cmlift parallel line). The pair-straddle in
# cam_sample reads one column east of each index, so the effective span leans a
# touch east; symmetric enough that climbs and descents stay identical.
scoreboard players operation .si ir = .cmctr ir
scoreboard players operation .si ir += .cmk ir
function infinite_rail:cam_sample
execute if score .sm ir > .cmmx ir run scoreboard players operation .cmmx ir = .sm ir
execute if score .cmk ir matches 0 run scoreboard players operation .cmr ir = .sm ir
scoreboard players add .cmk ir 1
execute if score .cmk ir <= .cmw ir run function infinite_rail:cam_maxscan
