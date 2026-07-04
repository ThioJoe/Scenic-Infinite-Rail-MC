# Advance the smoothed camera height #sy toward the target #ty (both in
# milliblocks). Rises follow at once -- climbs are already pre-smoothed into
# an S-curve by the window average -- but capped at 1 block/tick so an engage
# snap can never jolt the view. Descents ease reactively by 1/#CAMSMOOTH of
# the remaining gap per tick (the glide feel the physical cart can't give).
scoreboard players operation #dy ir = #ty ir
scoreboard players operation #dy ir -= #sy ir
execute if score #dy ir matches 1001.. run scoreboard players set #dy ir 1000
execute if score #dy ir matches ..-1 run scoreboard players operation #dy ir /= #CAMSMOOTH ir
scoreboard players operation #sy ir += #dy ir
