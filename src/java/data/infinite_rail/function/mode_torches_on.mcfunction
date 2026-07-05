# Mode toggle:  /function infinite_rail:mode_torches_on
# Torch scatter: as the track is built, torches are planted at random spots
# 2-8 blocks left and right of the line (#TORCHODDS percent of columns get
# one -- see config.mcfunction). Only NEW track ahead of the ride is
# affected; already-built track stays as it is. Made for mode_night_on, but
# an independent switch like every mode. The placement itself happens in
# place_torch/torch_try, hooked into advance.
scoreboard players set #TORCHMODE ir 1
tellraw @a [{"text":"[Infinite Rail] ","color":"gold"},{"text":"Torch mode ON - new track will be dotted with torches. ","color":"gray"},{"text":"/function infinite_rail:mode_torches_off","color":"aqua"},{"text":" stops them.","color":"gray"}]
