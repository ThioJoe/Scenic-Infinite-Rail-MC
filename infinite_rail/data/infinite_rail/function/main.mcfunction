# Per-tick driver while the ride is active.

# Track the cart's X position for the build-ahead gap calculation.
execute store result score #cartX ir run data get entity @e[type=minecart,tag=ir_cart,limit=1] Pos[0] 1

# Keepers: enforce who sits where. Nothing may occupy the cart except the
# rider (cart mode) or the plug (seat mode) -- ejects scooped-up mobs -- and
# the plug must vacate a perch the rider needs. Ejections first; the mounts
# below self-heal the rest.
execute as @e[type=minecart,tag=ir_cart,limit=1] on passengers unless entity @s[type=player] unless entity @s[type=item_display,tag=ir_plug] run ride @s dismount
execute unless score #onSeat ir matches 1 as @e[type=minecart,tag=ir_cart,limit=1] on passengers if entity @s[type=item_display,tag=ir_plug] run ride @s dismount
execute if score #onSeat ir matches 1 as @e[type=item_display,tag=ir_seat,limit=1] on passengers if entity @s[type=item_display,tag=ir_plug] run ride @s dismount

# Keeper: re-mount a dismounted rider per mode (handles dismounts / relogs)
# -- into the real cart on flat track, onto the camera seat around slopes.
execute if score #onSeat ir matches 1 as @a[gamemode=adventure] unless data entity @s RootVehicle run ride @s mount @e[type=item_display,tag=ir_seat,limit=1]
execute unless score #onSeat ir matches 1 as @a[gamemode=adventure] unless data entity @s RootVehicle run ride @s mount @e[type=minecart,tag=ir_cart,limit=1]

# Keeper: the plug takes whichever perch the rider doesn't, so the cart is
# never empty (an empty cart scoops up mobs and can be entered by
# right-click). Non-player passengers expose no vehicle tag to query, so the
# mount attempt itself is the check -- it just fails while already seated.
execute if score #onSeat ir matches 1 run ride @e[type=item_display,tag=ir_plug,limit=1] mount @e[type=minecart,tag=ir_cart,limit=1]
execute unless score #onSeat ir matches 1 run ride @e[type=item_display,tag=ir_plug,limit=1] mount @e[type=item_display,tag=ir_seat,limit=1]

# Keeper: if the cart ever stalls (mob collision, freak accident), re-boost it.
execute store result score #mx ir run data get entity @e[type=minecart,tag=ir_cart,limit=1] Motion[0] 100
execute if score #mx ir matches ..10 run data merge entity @e[type=minecart,tag=ir_cart,limit=1] {Motion:[0.5d,0.0d,0.0d]}

# Hybrid smooth camera: native cart on flats, gliding seat around slopes.
execute if entity @e[type=minecart,tag=ir_cart,limit=1] run function infinite_rail:cam_follow

# Extend the track ahead of the cart, up to #MAXTICK columns this tick.
scoreboard players operation #budget ir = #MAXTICK ir
function infinite_rail:build_loop
