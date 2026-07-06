# Mode toggle:  /function infinite_rail:mode_hidecart_on
# Hide the minecart: the visible ride cart is removed and the rider sits on
# the invisible camera seat directly -- an unobstructed view, floating on
# air. State like every mode (.HIDECART persists; launch_done seats new
# rides accordingly). Killing the cart dismounts the rider with it; the next
# tick's keeper re-seats them onto the seat (one vanilla dismount-hint toast
# per toggle -- unavoidable, same as a sneak-dismount).
scoreboard players set .HIDECART ir 1
kill @e[type=minecart,tag=ir_ride]
tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Minecart hidden - enjoy the unobstructed view.","color":"gray"}]
