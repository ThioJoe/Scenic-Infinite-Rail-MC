# One window sample at column offset #k from the cart (recursive: #k advances
# by 2 until it passes +#CAMWINDOW). Each sample is interpolated between its
# column and the next by the cart's sub-block X (#fx / #fi), so the average
# moves continuously instead of stepping when the cart crosses a block edge.
scoreboard players operation #si ir = #ci ir
scoreboard players operation #si ir += #k ir
execute if score #si ir matches ..-1 run scoreboard players set #si ir 0
execute if score #si ir > #cmaxi ir run scoreboard players operation #si ir = #cmaxi ir
scoreboard players operation #sj ir = #si ir
scoreboard players add #sj ir 1
execute if score #sj ir > #cmaxi ir run scoreboard players operation #sj ir = #cmaxi ir
execute store result storage infinite_rail:cami i int 1 run scoreboard players get #si ir
function infinite_rail:cam_get with storage infinite_rail:cami
scoreboard players operation #ya ir = #ly ir
execute store result storage infinite_rail:cami i int 1 run scoreboard players get #sj ir
function infinite_rail:cam_get with storage infinite_rail:cami
scoreboard players operation #yb ir = #ly ir

# Interpolated sample in milliblocks: ya*(1000-fx) + yb*fx.
scoreboard players operation #sm ir = #ya ir
scoreboard players operation #sm ir *= #fi ir
scoreboard players operation #t2 ir = #yb ir
scoreboard players operation #t2 ir *= #fx ir
scoreboard players operation #sm ir += #t2 ir
scoreboard players operation #csum ir += #sm ir
scoreboard players add #cn ir 1

# Flatness detection over everything touched (yb peeks one column further
# ahead, so the seat engages a touch before the average starts to move).
execute if score #ya ir < #cmin ir run scoreboard players operation #cmin ir = #ya ir
execute if score #ya ir > #cmax ir run scoreboard players operation #cmax ir = #ya ir
execute if score #yb ir < #cmin ir run scoreboard players operation #cmin ir = #yb ir
execute if score #yb ir > #cmax ir run scoreboard players operation #cmax ir = #yb ir

# The k = 0 sample IS the rail line height right at the cart. #flat0 records
# whether the rail is level across the cart's own column pair -- the only
# precondition the parity calibration needs (a whole-window flatness test
# could starve calibration forever in continuously hilly terrain).
execute if score #k ir matches 0 run scoreboard players operation #linem ir = #sm ir
execute if score #k ir matches 0 run scoreboard players set #flat0 ir 0
execute if score #k ir matches 0 if score #ya ir = #yb ir run scoreboard players set #flat0 ir 1

scoreboard players add #k ir 2
execute if score #k ir <= #CAMWINDOW ir run function infinite_rail:cam_scan
