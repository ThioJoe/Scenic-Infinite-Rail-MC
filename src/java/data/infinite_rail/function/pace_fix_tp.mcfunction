# Macro helper for pace_fix: teleport the stuck pace cart onto the built
# track. tp only takes literal coordinates, so the absolute block-center
# X/Z and rail-top Y arrive as macro args from storage infinite_rail:fix.
$tp @e[type=minecart,tag=ir_cart,limit=1] $(x) $(y) $(z)
