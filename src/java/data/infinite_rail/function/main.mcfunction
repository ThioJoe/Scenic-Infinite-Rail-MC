# Per-tick driver while the ride is active.

# Track the pace cart's X position for the build-ahead gap calculation.
execute store result score #cartX ir run data get entity @e[type=minecart,tag=ir_cart,limit=1] Pos[0] 1

# Ocean speed-up: sample the biome once per chunk crossed and raise/lower the
# minecart max-speed gamerule over long ocean stretches.
function infinite_rail:ocean_check

# Keepers: enforce who sits where. Only the plug may ride the pace cart (an
# empty cart scoops up passing mobs and can be entered by right-click), and
# only players may ride the ride cart. Ejections first; the mounts below
# self-heal the rest.
execute as @e[type=minecart,tag=ir_cart,limit=1] on passengers unless entity @s[type=item_display,tag=ir_plug] run ride @s dismount
execute as @e[type=minecart,tag=ir_ride,limit=1] on passengers unless entity @s[type=player] run ride @s dismount

# Keeper: re-mount a dismounted rider (sneak-dismounts, relogs) into the ride
# cart. (This re-triggers the vanilla dismount hint -- unavoidable, but it
# only ever happens when the rider left the ride themselves.)
execute as @a[gamemode=adventure] unless data entity @s RootVehicle run ride @s mount @e[type=minecart,tag=ir_ride,limit=1]

# Keeper: prevent the ride cart from visually tilting due to the minecart_improvements experiment.
execute as @e[type=minecart,tag=ir_ride,limit=1] run data modify entity @s Rotation[1] set value 0.0f

# Keeper: keep the player's inventory empty to hide held items and prevent picking things up.
clear @a[gamemode=adventure]

# Keepers: plug on the pace cart, ride cart on the seat. Non-player
# passengers expose no vehicle tag to query, so the mount attempt itself is
# the check -- it just fails silently while already seated.
ride @e[type=item_display,tag=ir_plug,limit=1] mount @e[type=minecart,tag=ir_cart,limit=1]
ride @e[type=minecart,tag=ir_ride,limit=1] mount @e[type=item_display,tag=ir_seat,limit=1]

# Keeper: if the pace cart ever stalls (mob collision, freak accident),
# re-boost it.
execute store result score #mx ir run data get entity @e[type=minecart,tag=ir_cart,limit=1] Motion[0] 100
execute if score #mx ir matches ..10 run data merge entity @e[type=minecart,tag=ir_cart,limit=1] {Motion:[0.5d,0.0d,0.0d]}

# Smooth camera: fly the rig along the recorded profile ahead of the pace cart.
execute if entity @e[type=minecart,tag=ir_cart,limit=1] run function infinite_rail:cam_follow

# Extend the track ahead of the pace cart, up to #MAXTICK columns this tick.
scoreboard players operation #budget ir = #MAXTICK ir
function infinite_rail:build_loop
