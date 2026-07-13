# surf_reset's filler (recursive): append one "never probed" slot per call
# until .suK runs out. Depth = the cache reach (~98 at the defaults) -- far
# under the raised chain budgets, and only ever runs on a reset.
data modify storage infinite_rail:surf c append value -32768
scoreboard players remove .suK ir 1
execute if score .suK ir matches 1.. run function infinite_rail:surf_seed
