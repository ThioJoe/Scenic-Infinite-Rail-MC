# Per-tick driver while the ride is active.

# Track the pace cart's X position for the build-ahead gap calculation.
execute store result score .cartX ir run data get entity @e[type=minecart,tag=ir_cart,limit=1] Pos[0] 1

# Ocean speed-up: sample the biome once per chunk crossed and raise/lower the
# minecart max-speed gamerule over long ocean stretches.
function infinite_rail:ocean_check

# Keepers: enforce who sits where. Only the plug may ride the pace cart (an
# empty cart scoops up passing mobs and can be entered by right-click), and
# only players may ride the ride cart. Ejections first; the mounts below
# self-heal the rest.
execute as @e[type=minecart,tag=ir_cart,limit=1] on passengers unless entity @s[type=item_display,tag=ir_plug] run ride @s dismount
execute as @e[type=minecart,tag=ir_ride,limit=1] on passengers unless entity @s[type=player] run ride @s dismount

# Keeper: re-mount a dismounted rider (sneak-dismounts, relogs) -- into the
# ride cart normally, or straight onto the seat while the cart is hidden
# (.HIDECART -- mode_hidecart_on; the seat is also how the rider changes
# perch on each toggle). (This re-triggers the vanilla dismount hint --
# unavoidable, but it only ever happens on a self-dismount or a toggle.)
execute if score .HIDECART ir matches 0 as @a[gamemode=adventure] unless data entity @s RootVehicle run ride @s mount @e[type=minecart,tag=ir_ride,limit=1]
execute if score .HIDECART ir matches 1 as @a[gamemode=adventure] unless data entity @s RootVehicle run ride @s mount @e[type=item_display,tag=ir_seat,limit=1]

# Keeper: while the cart is hidden, no ride cart may linger (belt +
# suspenders -- mode_hidecart_on already kills it).
execute if score .HIDECART ir matches 1 run kill @e[type=minecart,tag=ir_ride]

# Keeper: prevent the ride cart from visually tilting due to the minecart_improvements experiment.
execute as @e[type=minecart,tag=ir_ride,limit=1] run data modify entity @s Rotation[1] set value 0.0f

# Keeper: no creature may crowd the pace cart -- entities physically shove a
# minecart around, and a mob pile can slow or stall it outright. The rider is
# .CAMAHEAD blocks ahead, so nothing here is ever seen or heard. Every entity
# kind the ride itself uses is excluded (pace/ride carts, the plug/seat
# displays, the support-disguise block_displays, the head/probe markers);
# the kill sweeping up nearby dropped items/orbs too is fine -- doTileDrops
# is off and nobody is looking.
execute at @e[type=minecart,tag=ir_cart,limit=1] run kill @e[type=!player,type=!minecart,type=!marker,type=!item_display,type=!block_display,distance=..8]

# Keeper: the pace cart must never run through liquid -- water drags a
# minecart to a crawl and lava sets everything on fire. Clear any water/lava
# from the cart's cell and the one ahead of it (each plus the cell above --
# the cart is about a block tall). Flowing water can't waterlog the rails
# themselves (waterlogging only happens at placement), so clearing the open
# cells is the whole job; adjacent sources re-flow, but this runs every tick.
execute at @e[type=minecart,tag=ir_cart,limit=1] align xyz run fill ~ ~ ~ ~1 ~1 ~ minecraft:air replace minecraft:water
execute at @e[type=minecart,tag=ir_cart,limit=1] align xyz run fill ~ ~ ~ ~1 ~1 ~ minecraft:air replace minecraft:lava

# Keeper: vaporize dropped items and XP orbs before the rider glides into
# pickup range -- the inventory keeper deletes pickups instantly, but the
# pickup SOUND still plays; killing them ahead of time keeps the ride silent.
execute at @e[type=item_display,tag=ir_seat,limit=1] run kill @e[type=item,distance=..16]
execute at @e[type=item_display,tag=ir_seat,limit=1] run kill @e[type=experience_orb,distance=..16]

# Keeper: police the rider's inventory (give_menu): anything beyond the six
# pinned hotbar items is wiped, and a missing/wrong pinned item is re-pinned
# in place. (A blanket clear + re-give every tick used to re-fire the
# client's item-pickup animation nonstop, freezing every hotbar icon on the
# animation's first -- stretched -- frame.)
execute as @a[gamemode=adventure] run function infinite_rail:give_menu

# Keepers: plug on the pace cart, ride cart on the seat. Non-player
# passengers expose no vehicle tag to query, so the mount attempt itself is
# the check -- it just fails silently while already seated.
ride @e[type=item_display,tag=ir_plug,limit=1] mount @e[type=minecart,tag=ir_cart,limit=1]
ride @e[type=minecart,tag=ir_ride,limit=1] mount @e[type=item_display,tag=ir_seat,limit=1]

# Keeper: if the pace cart ever stalls (mob collision, freak accident),
# re-boost it.
execute store result score .mx ir run data get entity @e[type=minecart,tag=ir_cart,limit=1] Motion[0] 100
execute if score .mx ir matches ..10 run data merge entity @e[type=minecart,tag=ir_cart,limit=1] {Motion:[0.5d,0.0d,0.0d]}

# Smooth camera: fly the rig along the recorded profile ahead of the pace cart.
execute if entity @e[type=minecart,tag=ir_cart,limit=1] run function infinite_rail:cam_follow

# Minecart sound (mode_sound_* / .SOUNDMODE): re-trigger the vanilla
# first-person riding sample at the rider on a 115-tick clock (the exact
# length of entity.minecart.inside -- sound_loop plays it at a huge volume
# so it never fades as the ride glides). A pure /playsound loop, no cart or
# resource pack involved.
execute if score .SOUNDMODE ir matches 1 run scoreboard players add .sndt ir 1
execute if score .SOUNDMODE ir matches 1 if score .sndt ir matches 115.. run function infinite_rail:sound_loop

# Extend the track ahead of the pace cart, up to .MAXTICK columns this tick.
scoreboard players operation .budget ir = .MAXTICK cfg_ride
function infinite_rail:build_loop
