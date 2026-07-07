# Mode toggle:  /function infinite_rail:mode_torches_on
# Torch scatter, ALWAYS ON: as the track is built, torches are planted at
# random spots beside the line -- 2 up to .TORCHRANGE blocks out on either
# side, on .torchdens percent of columns (the menu's density presets; config
# .TORCHODDS is the seed) -- day and night, unlike the default auto mode
# (mode_torches_auto, night only; .TORCHMODE is a tri-state 0/1/2). Only
# NEW track ahead of the ride is affected; already-built track stays as it
# is. The placement itself happens in place_torch/torch_at/torch_try,
# hooked into advance.
scoreboard players set .TORCHMODE ir 1
tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Torch mode ON - new track will be dotted with torches, day and night.","color":"gray"}]
