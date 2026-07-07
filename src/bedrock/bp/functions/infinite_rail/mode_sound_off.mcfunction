# Mode toggle:  /function infinite_rail/mode_sound_off
# Silence the minecart riding sound (the classic silent glide). The playing
# sample loops natively forever (baked-in FMOD loop flag), so stopping it
# outright is the whole job -- the script's tickSound() also stops it
# itself on the next tick if this file is stale (outdated pack registry).
scoreboard players set .SOUNDMODE ir 0
stopsound @a ir.cart_roll
tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Minecart sound off."}]}
