# Settings-form preset: torch-mode density LOW. Sets the .torchdens state
# score (seeded from config .TORCHODDS by modes_init, rolled per column by
# the script's maybeTorch(); state -- survives reloads and rejoins).
# User-facing text is the friendly name only; the percentage is an
# implementation detail. Keep the four preset values in sync with Java's
# torch_density_* copies.
scoreboard players set .torchdens ir 15
tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Torch density: Low"}]}
