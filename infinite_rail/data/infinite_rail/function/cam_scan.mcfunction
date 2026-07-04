# One window sample at column offset #k from the rig (recursive: #k advances
# by 2 until it passes +#CAMWINDOW). Each sample is interpolated between its
# column and the next by the pace cart's sub-block X (#fx / #fi), so the
# average moves continuously instead of stepping when the cart crosses a
# block edge.
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

# The k = 0 sample IS the rail line height right at the rig.
execute if score #k ir matches 0 run scoreboard players operation #linem ir = #sm ir

scoreboard players add #k ir 2
execute if score #k ir <= #CAMWINDOW ir run function infinite_rail:cam_scan
