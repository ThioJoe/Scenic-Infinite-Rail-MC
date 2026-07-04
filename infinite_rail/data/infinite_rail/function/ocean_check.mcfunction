# Ocean speed-up. When the ride crosses a run of ocean-biome chunks, raise the
# minecart max-speed gamerule to #OCEANSPEED; after a run of non-ocean chunks,
# drop back to #MAXSPEED. The biome is sampled once per chunk the pace cart
# enters (so it reflects where the rider actually is, not the far-ahead head).
#
# Requires the minecart max-speed gamerule to exist (see set_speed); on worlds
# without the "Minecart Improvements" feature the speed changes are no-ops and
# the ride just cruises at vanilla speed the whole way.

# Which chunk is the pace cart in now? (cart X floored to 16-block chunks.)
scoreboard players operation #chunkNow ir = #cartX ir
scoreboard players operation #chunkNow ir /= #C16 ir
# Nothing to do unless the cart just crossed into a new chunk.
execute if score #chunkNow ir = #lastChunk ir run return 0
scoreboard players operation #lastChunk ir = #chunkNow ir

# Sample the biome under the pace cart: ocean or not? #minecraft:is_ocean
# covers every ocean-named biome (ocean, deep/warm/cold/frozen variants, ...).
scoreboard players set #isOcean ir 0
execute at @e[type=minecart,tag=ir_cart,limit=1] if biome ~ ~ ~ #minecraft:is_ocean run scoreboard players set #isOcean ir 1

# Ocean chunk: grow the ocean run, clear the land run.
execute if score #isOcean ir matches 1 run scoreboard players add #oceanRun ir 1
execute if score #isOcean ir matches 1 run scoreboard players set #landRun ir 0
# Enough consecutive ocean chunks, and not already fast -> speed up.
# (#OCEANSPEED 0 disables the feature, so it never triggers then.)
execute if score #isOcean ir matches 1 if score #fast ir matches 0 if score #OCEANSPEED ir matches 1.. if score #oceanRun ir >= #OCEANCHUNKS ir run function infinite_rail:speed_up

# Non-ocean chunk: grow the land run, clear the ocean run.
execute if score #isOcean ir matches 0 run scoreboard players add #landRun ir 1
execute if score #isOcean ir matches 0 run scoreboard players set #oceanRun ir 0
# Enough consecutive non-ocean chunks after a fast stretch -> back to default.
execute if score #isOcean ir matches 0 if score #fast ir matches 1 if score #landRun ir >= #LANDCHUNKS ir run function infinite_rail:speed_down
