# Prints every ride mode's current state:
#   /function infinite_rail/modes
# Rain/sky/sound/mobs-aggro are 1 = on, 0 = off. The second line spells out the
# tri-state time mode (.NIGHTMODE: 0 = default cycle, 1 = night only,
# 2 = day only) and the adjustable ride speed (.speed -- the Speed +/-
# items), with "(default)" when it equals the config .DEFAULTSPEED. The third
# line spells out the tri-state torch mode (.TORCHMODE: 0 = off, 1 = always
# on, 2 = auto/night only -- the default) and the fourth names the torch
# density preset (.torchdens -- friendly name only, the percentage stays
# behind the scenes; "Custom" = a hand-set or config-seeded value that
# matches no preset). The last line spells out the No-Thunderstorms mode
# (.STORMMODE: 1 = natural storms are switched to plain rain -- note the
# inversion, "Thunderstorms: off" is the mode being ON).
tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Modes - rain: §f"},{"score":{"name":".RAINMODE","objective":"ir"}},{"text":"§7 | sky: §f"},{"score":{"name":".SKYMODE","objective":"ir"}},{"text":"§7 | cart hidden: §f"},{"score":{"name":".HIDECART","objective":"ir"}},{"text":"§7 | sound: §f"},{"score":{"name":".SOUNDMODE","objective":"ir"}},{"text":"§7 | mobs aggro: §f"},{"score":{"name":".AGGROMODE","objective":"ir"}}]}
execute if score .NIGHTMODE ir matches 0 unless score .speed ir = .DEFAULTSPEED cfg_ride run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Time: default | speed: §f"},{"score":{"name":".speed","objective":"ir"}}]}
execute if score .NIGHTMODE ir matches 1 unless score .speed ir = .DEFAULTSPEED cfg_ride run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Time: night only | speed: §f"},{"score":{"name":".speed","objective":"ir"}}]}
execute if score .NIGHTMODE ir matches 2 unless score .speed ir = .DEFAULTSPEED cfg_ride run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Time: day only | speed: §f"},{"score":{"name":".speed","objective":"ir"}}]}
execute if score .NIGHTMODE ir matches 0 if score .speed ir = .DEFAULTSPEED cfg_ride run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Time: default | speed: §f"},{"score":{"name":".speed","objective":"ir"}},{"text":"§7 (default)"}]}
execute if score .NIGHTMODE ir matches 1 if score .speed ir = .DEFAULTSPEED cfg_ride run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Time: night only | speed: §f"},{"score":{"name":".speed","objective":"ir"}},{"text":"§7 (default)"}]}
execute if score .NIGHTMODE ir matches 2 if score .speed ir = .DEFAULTSPEED cfg_ride run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Time: day only | speed: §f"},{"score":{"name":".speed","objective":"ir"}},{"text":"§7 (default)"}]}
execute if score .TORCHMODE ir matches 0 run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Torches: off"}]}
execute if score .TORCHMODE ir matches 1 run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Torches: on (day and night)"}]}
execute if score .TORCHMODE ir matches 2 run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Torches: auto (at night, default)"}]}
execute if score .torchdens ir matches 15 run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Torch density: Low"}]}
execute if score .torchdens ir matches 35 run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Torch density: Medium (default)"}]}
execute if score .torchdens ir matches 70 run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Torch density: High"}]}
execute if score .torchdens ir matches 100 run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Torch density: Max"}]}
execute unless score .torchdens ir matches 15 unless score .torchdens ir matches 35 unless score .torchdens ir matches 70 unless score .torchdens ir matches 100 run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Torch density: Custom"}]}
execute if score .LIGHTMODE ir matches 11 run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Track light: on (default)"}]}
execute if score .LIGHTMODE ir matches 8 run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Track light: low"}]}
execute if score .LIGHTMODE ir matches 0 run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Track light: off"}]}
execute unless score .LIGHTMODE ir matches 0 unless score .LIGHTMODE ir matches 8 unless score .LIGHTMODE ir matches 11 run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Track light: custom (level §f"},{"score":{"name":".LIGHTMODE","objective":"ir"}},{"text":"§7)"}]}
execute if score .STORMMODE ir matches 1 run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Thunderstorms: off (switched to plain rain)"}]}
execute unless score .STORMMODE ir matches 1 run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Thunderstorms: on (default)"}]}
