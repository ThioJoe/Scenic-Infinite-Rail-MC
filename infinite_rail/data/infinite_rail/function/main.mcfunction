# Per-tick driver while the ride is active.

# Track the cart's X position for the build-ahead gap calculation.
execute store result score #cartX ir run data get entity @e[type=minecart,tag=ir_cart,limit=1] Pos[0] 1

# Keeper: if the rider ever dismounts (or rejoins), put them back on the
# camera seat (the invisible display entity they ride; see cam_follow).
execute as @a[gamemode=adventure] unless data entity @s RootVehicle run ride @s mount @e[type=item_display,tag=ir_seat,limit=1]

# Keeper: if the cart ever stalls (mob collision, freak accident), re-boost it.
execute store result score #mx ir run data get entity @e[type=minecart,tag=ir_cart,limit=1] Motion[0] 100
execute if score #mx ir matches ..10 run data merge entity @e[type=minecart,tag=ir_cart,limit=1] {Motion:[0.5d,0.0d,0.0d]}

# Smooth camera: glide the seat along the cart's path.
execute if entity @e[type=minecart,tag=ir_cart,limit=1] run function infinite_rail:cam_follow

# Extend the track ahead of the cart, up to #MAXTICK columns this tick.
scoreboard players operation #budget ir = #MAXTICK ir
function infinite_rail:build_loop
