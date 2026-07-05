# Prints every ride mode's current state (1 = on, 0 = off):
#   /function infinite_rail:modes
tellraw @a [{"text":"[Infinite Rail] ","color":"gold"},{"text":"Modes - rain: ","color":"gray"},{"score":{"name":"#RAINMODE","objective":"ir"},"color":"white"},{"text":" | night: ","color":"gray"},{"score":{"name":"#NIGHTMODE","objective":"ir"},"color":"white"},{"text":" | torches: ","color":"gray"},{"score":{"name":"#TORCHMODE","objective":"ir"},"color":"white"},{"text":" | sky: ","color":"gray"},{"score":{"name":"#SKYMODE","objective":"ir"},"color":"white"}]
