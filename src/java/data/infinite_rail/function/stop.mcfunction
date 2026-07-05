# Ends the ride and cleans up. The world and track are left as-is.
scoreboard players set #started ir 0
effect clear @a[gamemode=adventure]
# Take the Settings book (the mode-menu item) back -- the ride is over.
clear @a[gamemode=adventure] minecraft:written_book
execute as @a[gamemode=adventure] run ride @s dismount
kill @e[type=minecart,tag=ir_cart]
kill @e[type=minecart,tag=ir_ride]
kill @e[type=item_display,tag=ir_seat]
kill @e[type=item_display,tag=ir_plug]
kill @e[type=marker,tag=ir_head]
kill @e[type=marker,tag=ir_probe]
forceload remove all
tellraw @a [{"text":"[Infinite Rail] ","color":"gold"},{"text":"Ride stopped.","color":"gray"}]
