# Prints every ride mode's current state:
#   /function infinite_rail/modes
# Rain/torches/sky are 1 = on, 0 = off. The second line spells out the
# tri-state time mode (.NIGHTMODE: 0 = default cycle, 1 = night only,
# 2 = day only) and the adjustable ride speed (.speed -- the Speed +/-
# items), with "(default)" when it equals the config .MAXSPEED. The third
# line names the torch density preset (.torchdens -- friendly name only, the
# percentage stays behind the scenes; "Custom" = a hand-set or config-seeded
# value that matches no preset).
tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Modes - rain: §f"},{"score":{"name":".RAINMODE","objective":"ir"}},{"text":"§7 | torches: §f"},{"score":{"name":".TORCHMODE","objective":"ir"}},{"text":"§7 | sky: §f"},{"score":{"name":".SKYMODE","objective":"ir"}},{"text":"§7 | cart hidden: §f"},{"score":{"name":".HIDECART","objective":"ir"}}]}
execute if score .NIGHTMODE ir matches 0 unless score .speed ir = .MAXSPEED cfg_ride run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Time: default | speed: §f"},{"score":{"name":".speed","objective":"ir"}}]}
execute if score .NIGHTMODE ir matches 1 unless score .speed ir = .MAXSPEED cfg_ride run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Time: night only | speed: §f"},{"score":{"name":".speed","objective":"ir"}}]}
execute if score .NIGHTMODE ir matches 2 unless score .speed ir = .MAXSPEED cfg_ride run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Time: day only | speed: §f"},{"score":{"name":".speed","objective":"ir"}}]}
execute if score .NIGHTMODE ir matches 0 if score .speed ir = .MAXSPEED cfg_ride run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Time: default | speed: §f"},{"score":{"name":".speed","objective":"ir"}},{"text":"§7 (default)"}]}
execute if score .NIGHTMODE ir matches 1 if score .speed ir = .MAXSPEED cfg_ride run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Time: night only | speed: §f"},{"score":{"name":".speed","objective":"ir"}},{"text":"§7 (default)"}]}
execute if score .NIGHTMODE ir matches 2 if score .speed ir = .MAXSPEED cfg_ride run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Time: day only | speed: §f"},{"score":{"name":".speed","objective":"ir"}},{"text":"§7 (default)"}]}
execute if score .torchdens ir matches 15 run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Torch density: Low"}]}
execute if score .torchdens ir matches 35 run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Torch density: Medium (default)"}]}
execute if score .torchdens ir matches 70 run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Torch density: High"}]}
execute if score .torchdens ir matches 100 run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Torch density: Max"}]}
execute unless score .torchdens ir matches 15 unless score .torchdens ir matches 35 unless score .torchdens ir matches 70 unless score .torchdens ir matches 100 run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Torch density: Custom"}]}
