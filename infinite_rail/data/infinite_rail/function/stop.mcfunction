# Ends the ride and cleans up. The world and track are left as-is.
scoreboard players set #started ir 0
effect clear @a[gamemode=adventure]
execute as @a[gamemode=adventure] run ride @s dismount
kill @e[type=minecart,tag=ir_cart]
kill @e[type=item_display,tag=ir_seat]
kill @e[type=marker,tag=ir_head]
kill @e[type=marker,tag=ir_probe]
forceload remove all
tellraw @a [{"text":"[Infinite Rail] ","color":"gold"},{"text":"Ride stopped.","color":"gray"}]
