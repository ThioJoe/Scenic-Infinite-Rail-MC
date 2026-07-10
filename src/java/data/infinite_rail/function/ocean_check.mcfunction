# Ocean speed-up. When the ride crosses a run of ocean-biome chunks (frozen
# oceans excluded -- they read as land), switch the minecart max-speed
# gamerule to the OCEAN cruise speed (.ocnspd -- adjustable state, default
# the config .OCEANSPEED; the Speed items tune it in both directions while
# the sprint is on); after a run of non-ocean chunks, drop back to the land
# cruising speed (.speed -- the config default .DEFAULTSPEED unless adjusted).
# Sampled once per chunk, at the RIDER'S position (the seat carries the
# player, (.PACE_CART_BEHIND - .RIDER_BEHIND) blocks ahead of the pace cart), so the speed reflects the
# biome the viewer is actually flying over -- not the pace cart trailing far
# behind.
#
# Over ocean the cruise is RE-APPLIED every chunk (see speed_up), so it
# always sticks and any manual /gamerule change or desynced state self-heals.
# The land speed (.speed) is restored only once, on the transition back, so
# you can still tweak the gamerule by hand on land.
#
# Requires the minecart max-speed gamerule to exist (see set_speed); on worlds
# without the "Minecart Improvements" feature the speed changes are no-ops and
# the ride just cruises at vanilla speed the whole way.

# Sky mode owns the ride speed while it is on (and the line flies far above
# any water anyway) -- skip the whole ocean system. mode_sky_off resets the
# run counters and .fast and restores the land speed (.speed) on the way out.
execute if score .SKYMODE ir matches 1 run return 0

# Which chunk is the rider (seat) in now? (X floored to 16-block chunks.)
execute store result score .rigX ir run data get entity @e[type=item_display,tag=ir_seat,limit=1] Pos[0] 1
scoreboard players operation .chunkNow ir = .rigX ir
scoreboard players operation .chunkNow ir /= .C16 ir
# Nothing to do unless the rider just crossed into a new chunk.
execute if score .chunkNow ir = .lastChunk ir run return 0
scoreboard players operation .lastChunk ir = .chunkNow ir

# Sample the biome under the rider: ocean or not? #minecraft:is_ocean covers
# every ocean-named biome -- but the FROZEN oceans are excluded (treated like
# land): their icebergs and pack ice are scenery worth watching, not an empty
# stretch to sprint across.
scoreboard players set .isOcean ir 0
execute at @e[type=item_display,tag=ir_seat,limit=1] if biome ~ ~ ~ #minecraft:is_ocean unless biome ~ ~ ~ minecraft:frozen_ocean unless biome ~ ~ ~ minecraft:deep_frozen_ocean unless biome ~ ~ ~ minecraft:warm_ocean run scoreboard players set .isOcean ir 1

# Debug helper: the pace cart's actual eastward speed x100 (0.4/tick ~= 40 at
# vanilla 8 m/s, ~160 at 32 m/s). If this never climbs after a speed change, the
# world lacks the Minecart Improvements gamerule.
execute if score .DEBUGMODE ir matches 1 store result score .dbgmx ir run data get entity @e[type=minecart,tag=ir_cart,limit=1] Motion[0] 100

# Ocean chunk: grow the ocean run, clear the land run.
execute if score .isOcean ir matches 1 run scoreboard players add .oceanRun ir 1
execute if score .isOcean ir matches 1 run scoreboard players set .landRun ir 0
# Debug: report only while counting up to the threshold, then go quiet.
execute if score .DEBUGMODE ir matches 1 if score .isOcean ir matches 1 if score .oceanRun ir <= .OCEANCHUNKS cfg_ride run tellraw @a [{"text":"[SR Debug] ","color":"dark_aqua"},{"text":"ocean chunk - oceanRun=","color":"aqua"},{"score":{"name":".oceanRun","objective":"ir"},"color":"white"},{"text":"/","color":"aqua"},{"score":{"name":".OCEANCHUNKS","objective":"cfg_ride"},"color":"white"},{"text":"  cartx100=","color":"gray"},{"score":{"name":".dbgmx","objective":"ir"},"color":"white"}]
# Past the ocean threshold -> enforce the ocean cruise .ocnspd (re-applied
# every ocean chunk). (.OCEANSPEED 0 disables the feature, so it never
# triggers then.)
execute if score .isOcean ir matches 1 if score .OCEANSPEED cfg_ride matches 1.. if score .oceanRun ir >= .OCEANCHUNKS cfg_ride run function infinite_rail:speed_up

# Non-ocean chunk: grow the land run, clear the ocean run.
execute if score .isOcean ir matches 0 run scoreboard players add .landRun ir 1
execute if score .isOcean ir matches 0 run scoreboard players set .oceanRun ir 0
# Debug: report only while counting up to the threshold, then go quiet.
execute if score .DEBUGMODE ir matches 1 if score .isOcean ir matches 0 if score .landRun ir <= .LANDCHUNKS cfg_ride run tellraw @a [{"text":"[SR Debug] ","color":"dark_aqua"},{"text":"land chunk - landRun=","color":"yellow"},{"score":{"name":".landRun","objective":"ir"},"color":"white"},{"text":"/","color":"yellow"},{"score":{"name":".LANDCHUNKS","objective":"cfg_ride"},"color":"white"},{"text":"  cartx100=","color":"gray"},{"score":{"name":".dbgmx","objective":"ir"},"color":"white"}]
# Enough consecutive non-ocean chunks after a fast stretch -> restore .DEFAULTSPEED once.
execute if score .isOcean ir matches 0 if score .fast ir matches 1 if score .landRun ir >= .LANDCHUNKS cfg_ride run function infinite_rail:speed_down
