# Mode toggle:  /function infinite_rail:mode_torches_auto
# Torch scatter, AUTO (the default): torches are planted beside new track
# only while the world clock says night, so the ride lights its own way as
# darkness falls and track built in daylight stays clean. The day/night
# window lives in the shared torch_auto (dusk 12542 .. dawn 23459), which
# place_torch asks per candidate column; density, range and the over-water
# sea-pickle behavior are exactly mode_torches_on's. Composes with the time
# modes for free: a frozen-midnight world is always inside the window, a
# frozen-noon world never. .TORCHMODE is a tri-state: 0 = off, 1 = always
# on, 2 = auto.
scoreboard players set .TORCHMODE ir 2
tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Torch mode AUTO - torches will appear beside new track at night.","color":"gray"}]
