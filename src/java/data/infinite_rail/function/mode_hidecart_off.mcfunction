# Mode toggle:  /function infinite_rail:mode_hidecart_off
# Show the minecart again: rebuild the ride cart at the seat (mid-ride only;
# a stopped world has no rig), perch it back on the seat, and unseat the
# rider so the next tick's keeper moves them from the seat into the cart
# (one vanilla dismount-hint toast per toggle -- unavoidable). The summon
# mirrors launch_done's ride-cart line exactly.
scoreboard players set .HIDECART ir 0
execute if score .started ir matches 1 unless entity @e[type=minecart,tag=ir_ride,limit=1] at @e[type=item_display,tag=ir_seat,limit=1] run summon minecraft:minecart ~ ~ ~ {Tags:["ir_ride"],Invulnerable:1b,Rotation:[90f,0f]}
ride @e[type=minecart,tag=ir_ride,limit=1] mount @e[type=item_display,tag=ir_seat,limit=1]
execute as @a[gamemode=adventure] if data entity @s RootVehicle run ride @s dismount
tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Minecart visible again.","color":"gray"}]
