# Finishes a launch begun by begin (called from launch_tick once the runway
# is built): summons the camera rig, seats the rider -- the ONE player mount
# of the ride -- and hands off to the per-tick driver.
#
# The rig: the invisible interpolated seat (the mover) + the real minecart
# the player sits in, stacked seat -> cart -> player. Clients position
# passengers from their vehicle every frame, so the stack moves rigidly and
# the cart can never bounce, tilt or shift against the rider's view.
# teleport_duration:1 keeps the seat's interpolation in the same class as
# normal entity movement so the world glides by smoothly.
#
# Both rig pieces are summoned AT THE RIDER and mounted at distance zero;
# the cam_follow call below then snaps the whole stack to its cruising
# position with the exact same absolute teleport the ride performs every
# tick thereafter. The rider mounts ONCE, here, and is never remounted
# during the ride (mount events flash the vanilla "press X to dismount"
# hint, which can't be hidden).
execute at @e[type=player,tag=ir_rider,limit=1] run summon minecraft:item_display ~ ~1 ~ {Tags:["ir_seat"],teleport_duration:1}
execute at @e[type=player,tag=ir_rider,limit=1] run summon minecraft:minecart ~ ~1 ~ {Tags:["ir_ride"],Invulnerable:1b,Rotation:[90f,0f]}
ride @e[type=minecart,tag=ir_ride,limit=1] mount @e[type=item_display,tag=ir_seat,limit=1]
# Adventure mode is applied BEFORE the mount on purpose: the per-tick rider
# keeper (main) recaptures dismounted ADVENTURE players, so even if the
# mount below ever failed transiently, the keeper heals it a tick later.
# (The old order -- mount, then gamemode -- left a failed mount unrecoverable:
# a non-adventure rider is invisible to the keeper.)
execute as @e[type=player,tag=ir_rider,limit=1] run gamemode adventure @s
execute as @e[type=player,tag=ir_rider,limit=1] run effect give @s minecraft:resistance infinite 255 true
execute as @e[type=player,tag=ir_rider,limit=1] run effect give @s minecraft:saturation infinite 0 true
# The rider is visible (they sit in a real cart) -- clear any leftover
# invisibility from rides started on older pack versions.
execute as @e[type=player,tag=ir_rider,limit=1] run effect clear @s minecraft:invisibility
execute as @e[type=player,tag=ir_rider,limit=1] run ride @s mount @e[type=minecart,tag=ir_ride,limit=1]

# --- Snap the rig (rider aboard) to its cruising position and hand off ---
# The S-curve (c1) is stateless; only the descent chaser (.s2) needs seeding.
scoreboard players operation .s2 ir = .railY ir
scoreboard players operation .s2 ir *= .C1000 ir
function infinite_rail:cam_follow
scoreboard players set .started ir 1
tellraw @a [{"text":"[Infinite Rail] ","color":"gold"},{"text":"Enjoy the ride.","color":"gray"}]
# Loud diagnostic instead of a silent no-op: if the rider still is not
# seated, say so. The keeper retries the mount every tick regardless.
execute as @e[type=player,tag=ir_rider,limit=1] unless data entity @s RootVehicle run tellraw @a [{"text":"[Infinite Rail] ","color":"gold"},{"text":"Warning: could not seat the rider yet (retrying every tick). If this persists, please report it with your exact Minecraft version.","color":"yellow"}]
