# Reads one interpolated profile height into #sm (milliblocks): the column
# #si (clamped to the built range) and its neighbor, blended by the pace
# cart's sub-block X (#fx / #fi) so values move continuously instead of
# stepping when the cart crosses a block edge. The pair straddle also means
# scans effectively see one column past their nominal end.
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
scoreboard players operation #sm ir = #ya ir
scoreboard players operation #sm ir *= #fi ir
scoreboard players operation #t2 ir = #yb ir
scoreboard players operation #t2 ir *= #fx ir
scoreboard players operation #sm ir += #t2 ir
