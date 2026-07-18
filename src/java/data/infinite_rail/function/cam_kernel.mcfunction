# One triangle-kernel tap (recursive: .cmj runs from -.cmhm to +.cmhm). The
# weight is .cmh-|.cmj| (a triangle peaking at the rig), so this single pass
# rounds every corner of the lifted() envelope into one smooth curve. Each tap
# evaluates lifted() at column .ci+.cmj (cam_maxlift -> .cmlv) and accumulates
# it weighted into .cmsum / .cmden; cam_follow divides them for the height.
# |.cmj|:
scoreboard players operation .cmabs ir = .cmj ir
scoreboard players set .cmt ir 0
scoreboard players operation .cmt ir -= .cmj ir
execute if score .cmj ir matches ..-1 run scoreboard players operation .cmabs ir = .cmt ir
# weight = .cmh - |.cmj|
scoreboard players operation .cmwt ir = .cmh ir
scoreboard players operation .cmwt ir -= .cmabs ir
# lifted() at this tap's column
scoreboard players operation .cmctr ir = .ci ir
scoreboard players operation .cmctr ir += .cmj ir
function infinite_rail:cam_maxlift
# accumulate weighted
scoreboard players operation .cmlv ir *= .cmwt ir
scoreboard players operation .cmsum ir += .cmlv ir
scoreboard players operation .cmden ir += .cmwt ir
scoreboard players add .cmj ir 1
execute if score .cmj ir <= .cmhm ir run function infinite_rail:cam_kernel
