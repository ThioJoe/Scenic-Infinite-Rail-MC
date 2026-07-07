# Mode toggle:  /function infinite_rail/mode_torches_on
# Torch scatter, ALWAYS ON: as the track is built, torches are planted at
# random spots beside the line -- 2 up to .TORCHRANGE blocks out on either
# side, on .torchdens percent of columns (the menu's density presets; config
# .TORCHODDS is the seed) -- day and night, unlike the default auto mode
# (mode_torches_auto, night only; .TORCHMODE is a tri-state 0/1/2). Only
# NEW track ahead of the ride is affected. The placement itself is native:
# scripts/main.js watches .TORCHMODE (torchLit()) and plants the torches
# from its column builder.
scoreboard players set .TORCHMODE ir 1
tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Torch mode ON - new track will be dotted with torches, day and night."}]}
