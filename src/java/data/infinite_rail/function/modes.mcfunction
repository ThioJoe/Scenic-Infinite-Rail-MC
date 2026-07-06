# Prints every ride mode's current state:
#   /function infinite_rail:modes
# Rain/torches/sky are 1 = on, 0 = off. The second line spells out the
# tri-state time mode (.NIGHTMODE: 0 = default cycle, 1 = night only,
# 2 = day only) and the adjustable ride speed (.speed -- the Speed +/-
# items), with "(default)" when it equals the config .MAXSPEED. The third
# line names the torch density preset (.torchdens -- friendly name only, the
# percentage stays behind the scenes; "Custom" = a hand-set or config-seeded
# value that matches no preset).
tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Modes - rain: ","color":"gray"},{"score":{"name":".RAINMODE","objective":"ir"},"color":"white"},{"text":" | torches: ","color":"gray"},{"score":{"name":".TORCHMODE","objective":"ir"},"color":"white"},{"text":" | sky: ","color":"gray"},{"score":{"name":".SKYMODE","objective":"ir"},"color":"white"},{"text":" | cart hidden: ","color":"gray"},{"score":{"name":".HIDECART","objective":"ir"},"color":"white"}]
execute if score .NIGHTMODE ir matches 0 unless score .speed ir = .MAXSPEED cfg_ride run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Time: default | speed: ","color":"gray"},{"score":{"name":".speed","objective":"ir"},"color":"white"}]
execute if score .NIGHTMODE ir matches 1 unless score .speed ir = .MAXSPEED cfg_ride run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Time: night only | speed: ","color":"gray"},{"score":{"name":".speed","objective":"ir"},"color":"white"}]
execute if score .NIGHTMODE ir matches 2 unless score .speed ir = .MAXSPEED cfg_ride run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Time: day only | speed: ","color":"gray"},{"score":{"name":".speed","objective":"ir"},"color":"white"}]
execute if score .NIGHTMODE ir matches 0 if score .speed ir = .MAXSPEED cfg_ride run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Time: default | speed: ","color":"gray"},{"score":{"name":".speed","objective":"ir"},"color":"white"},{"text":" (default)","color":"gray"}]
execute if score .NIGHTMODE ir matches 1 if score .speed ir = .MAXSPEED cfg_ride run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Time: night only | speed: ","color":"gray"},{"score":{"name":".speed","objective":"ir"},"color":"white"},{"text":" (default)","color":"gray"}]
execute if score .NIGHTMODE ir matches 2 if score .speed ir = .MAXSPEED cfg_ride run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Time: day only | speed: ","color":"gray"},{"score":{"name":".speed","objective":"ir"},"color":"white"},{"text":" (default)","color":"gray"}]
execute if score .torchdens ir matches 15 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Torch density: Low","color":"gray"}]
execute if score .torchdens ir matches 35 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Torch density: Medium (default)","color":"gray"}]
execute if score .torchdens ir matches 70 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Torch density: High","color":"gray"}]
execute if score .torchdens ir matches 100 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Torch density: Max","color":"gray"}]
execute unless score .torchdens ir matches 15 unless score .torchdens ir matches 35 unless score .torchdens ir matches 70 unless score .torchdens ir matches 100 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Torch density: Custom","color":"gray"}]
