# Prints every ride mode's current state:
#   /function infinite_rail:modes
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
tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Modes - rain: ","color":"gray"},{"score":{"name":".RAINMODE","objective":"ir"},"color":"white"},{"text":" | sky: ","color":"gray"},{"score":{"name":".SKYMODE","objective":"ir"},"color":"white"},{"text":" | cart hidden: ","color":"gray"},{"score":{"name":".HIDECART","objective":"ir"},"color":"white"},{"text":" | sound: ","color":"gray"},{"score":{"name":".SOUNDMODE","objective":"ir"},"color":"white"},{"text":" | mobs aggro: ","color":"gray"},{"score":{"name":".AGGROMODE","objective":"ir"},"color":"white"}]
execute if score .NIGHTMODE ir matches 0 unless score .speed ir = .DEFAULTSPEED cfg_ride run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Time: default | speed: ","color":"gray"},{"score":{"name":".speed","objective":"ir"},"color":"white"}]
execute if score .NIGHTMODE ir matches 1 unless score .speed ir = .DEFAULTSPEED cfg_ride run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Time: night only | speed: ","color":"gray"},{"score":{"name":".speed","objective":"ir"},"color":"white"}]
execute if score .NIGHTMODE ir matches 2 unless score .speed ir = .DEFAULTSPEED cfg_ride run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Time: day only | speed: ","color":"gray"},{"score":{"name":".speed","objective":"ir"},"color":"white"}]
execute if score .NIGHTMODE ir matches 0 if score .speed ir = .DEFAULTSPEED cfg_ride run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Time: default | speed: ","color":"gray"},{"score":{"name":".speed","objective":"ir"},"color":"white"},{"text":" (default)","color":"gray"}]
execute if score .NIGHTMODE ir matches 1 if score .speed ir = .DEFAULTSPEED cfg_ride run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Time: night only | speed: ","color":"gray"},{"score":{"name":".speed","objective":"ir"},"color":"white"},{"text":" (default)","color":"gray"}]
execute if score .NIGHTMODE ir matches 2 if score .speed ir = .DEFAULTSPEED cfg_ride run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Time: day only | speed: ","color":"gray"},{"score":{"name":".speed","objective":"ir"},"color":"white"},{"text":" (default)","color":"gray"}]
execute if score .TORCHMODE ir matches 0 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Torches: off","color":"gray"}]
execute if score .TORCHMODE ir matches 1 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Torches: on (day and night)","color":"gray"}]
execute if score .TORCHMODE ir matches 2 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Torches: auto (at night, default)","color":"gray"}]
execute if score .torchdens ir matches 15 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Torch density: Low","color":"gray"}]
execute if score .torchdens ir matches 35 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Torch density: Medium (default)","color":"gray"}]
execute if score .torchdens ir matches 70 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Torch density: High","color":"gray"}]
execute if score .torchdens ir matches 100 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Torch density: Max","color":"gray"}]
execute unless score .torchdens ir matches 15 unless score .torchdens ir matches 35 unless score .torchdens ir matches 70 unless score .torchdens ir matches 100 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Torch density: Custom","color":"gray"}]
execute if score .LIGHTMODE ir matches 11 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Track light: on (default)","color":"gray"}]
execute if score .LIGHTMODE ir matches 8 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Track light: low","color":"gray"}]
execute if score .LIGHTMODE ir matches 0 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Track light: off","color":"gray"}]
execute unless score .LIGHTMODE ir matches 0 unless score .LIGHTMODE ir matches 8 unless score .LIGHTMODE ir matches 11 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Track light: custom (level ","color":"gray"},{"score":{"name":".LIGHTMODE","objective":"ir"},"color":"white"},{"text":")","color":"gray"}]
execute if score .STORMMODE ir matches 1 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Thunderstorms: off (switched to plain rain)","color":"gray"}]
execute unless score .STORMMODE ir matches 1 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Thunderstorms: on (default)","color":"gray"}]
