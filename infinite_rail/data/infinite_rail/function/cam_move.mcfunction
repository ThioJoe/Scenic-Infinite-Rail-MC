# Teleports the camera seat to the cart's X/Z at the smoothed height #sy.
# Runs every tick in BOTH modes -- in cart mode the seat carries the plug and
# still has to travel with the ride (an unmoved entity would be left behind in
# chunks that then unload). X/Z are copied from the cart's NBT as doubles (no
# precision loss or overflow however far east the ride gets); tp needs literal
# coordinates, so everything goes through the cam_tp macro.
execute store result storage infinite_rail:cam y double 0.001 run scoreboard players get #sy ir
data modify storage infinite_rail:cam x set from entity @e[type=minecart,tag=ir_cart,limit=1] Pos[0]
data modify storage infinite_rail:cam z set from entity @e[type=minecart,tag=ir_cart,limit=1] Pos[2]
function infinite_rail:cam_tp with storage infinite_rail:cam
