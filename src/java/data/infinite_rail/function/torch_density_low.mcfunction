# Settings-book preset: torch-mode density LOW. Sets the .torchdens state
# score (seeded from config .TORCHODDS by modes_init, rolled per column by
# place_torch; state -- survives reloads and rejoins). User-facing text is
# the friendly name only; the percentage is an implementation detail. Keep
# the four preset values in sync with Bedrock's torch_density_* copies.
scoreboard players set .torchdens ir 15
tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Torch density: Low","color":"gray"}]
