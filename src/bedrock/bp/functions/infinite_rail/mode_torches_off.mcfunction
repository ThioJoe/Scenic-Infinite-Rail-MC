# Mode toggle:  /function infinite_rail/mode_torches_off
# Stops planting torches along new track. Torches already placed stay where
# they are.
scoreboard players set .TORCHMODE ir 0
tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Torch mode OFF - new track stays unlit."}]}
