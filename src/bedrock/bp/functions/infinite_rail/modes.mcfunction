# Prints every ride mode's current state (1 = on, 0 = off):
#   /function infinite_rail/modes
tellraw @a {"rawtext":[{"text":"§6[Infinite Rail]§r §7Modes - rain: §f"},{"score":{"name":".RAINMODE","objective":"ir"}},{"text":"§7 | night: §f"},{"score":{"name":".NIGHTMODE","objective":"ir"}},{"text":"§7 | torches: §f"},{"score":{"name":".TORCHMODE","objective":"ir"}},{"text":"§7 | sky: §f"},{"score":{"name":".SKYMODE","objective":"ir"}}]}
