# Builds columns while the head is closer than .AHEAD blocks to the cart
# and this tick's budget is not exhausted.
#
# THE HEAD MUST BE SELECTABLE (loaded, in an entity-ticking chunk) or no
# column is built at all. Every physical step of a column -- the head tp,
# the block placement, the terrain probes -- runs through @e[tag=ir_head]
# and silently no-ops when the head's chunk is unloaded, while the
# scoreboard half (.railY, .headX, the track history the camera flies) has
# no selector and would keep advancing: the virtual line and the physical
# track diverge, the camera ends up offset below/behind the real rails, and
# the rider suffocates in uncarved ground. If chunk loading ever fails
# (forceload broken on a new game version, corridor released early,
# whatever), this gate PAUSES building consistently instead -- the ride
# runs out of track and stalls, ugly but coherent, and resumes the moment
# the head's chunk is back. main warns in chat when the head stays missing.
scoreboard players operation .gap ir = .headX ir
scoreboard players operation .gap ir -= .cartX ir
execute if score .budget ir matches 1.. if score .gap ir < .AHEAD cfg_ride if entity @e[type=marker,tag=ir_head,limit=1] run function infinite_rail:build_step
