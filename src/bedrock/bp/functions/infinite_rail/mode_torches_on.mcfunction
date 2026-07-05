# Mode toggle:  /function infinite_rail/mode_torches_on
# Torch scatter: as the track is built, torches are planted at random spots
# 2-8 blocks left and right of the line (.TORCHODDS percent of columns get
# one -- see config.mcfunction). Only NEW track ahead of the ride is
# affected. Made for mode_night_on, but an independent switch like every
# mode. The placement itself is native: scripts/main.js watches .TORCHMODE
# and plants the torches from its column builder.
scoreboard players set .TORCHMODE ir 1
tellraw @a {"rawtext":[{"text":"§6[Infinite Rail]§r §7Torch mode ON - new track will be dotted with torches. §b/function infinite_rail/mode_torches_off§7 stops them."}]}
