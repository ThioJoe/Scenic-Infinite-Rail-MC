tp @s 0 201 0
setblock 0 198 0 minecraft:smooth_stone
setblock 0 199 0 minecraft:redstone_torch
setblock 0 200 0 minecraft:smooth_stone
setblock 0 201 0 minecraft:powered_rail[shape=east_west]
setblock 0 202 0 minecraft:air
setblock 0 203 0 minecraft:air
summon minecart 0 201 0 {Motion:[0.5,0.0,0.0],Tags:["starter_cart"]}
ride @s mount @e[type=minecart,tag=starter_cart,limit=1,sort=nearest]
tag @e[type=minecart,tag=starter_cart] remove starter_cart
