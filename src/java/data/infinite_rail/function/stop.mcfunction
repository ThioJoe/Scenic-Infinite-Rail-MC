# Ends the ride and cleans up. The world and track are left as-is.
# (Setting .started 0 also cancels a launch still in progress -- .started 2.)
scoreboard players set .started ir 0
tag @a remove ir_rider
# Cut the riding-sound loop's tail (up to ~5.8 s of the last played copy).
stopsound @a neutral minecraft:entity.minecart.inside
effect clear @a[gamemode=adventure]
# Take the hotbar items back -- the Ride/Visual Settings, Tips and Debug
# books and the Speed +/- items (re-modeled carrot_on_a_sticks) -- the ride
# is over.
clear @a[gamemode=adventure] minecraft:written_book
clear @a[gamemode=adventure] minecraft:carrot_on_a_stick
execute as @a[gamemode=adventure] run ride @s dismount
kill @e[type=minecart,tag=ir_cart]
kill @e[type=minecart,tag=ir_ride]
kill @e[type=item_display,tag=ir_seat]
kill @e[type=item_display,tag=ir_plug]
kill @e[type=marker,tag=ir_head]
kill @e[type=marker,tag=ir_probe]
forceload remove all
tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Ride stopped.","color":"gray"}]
