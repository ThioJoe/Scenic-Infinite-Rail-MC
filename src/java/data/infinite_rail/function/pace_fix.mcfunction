# The pace-cart recovery, called by pace_watch when the cart is stuck (or
# has been missing for two checks): put a cart back ON the built track, a
# few rails ahead of where it stands, moving east. Everything is computed
# from the pack's own state -- no entity needs to be loaded for the math,
# and the teleport/summon lands at absolute coordinates -- so recovery works
# even while the head marker's chunk is unloaded (the exact situation that
# strands a derailed cart in the first place).
#
# Target column: min(lastX + 3, .headX - 2), floored into the cart's normal
# zone (.headX - .PACE_CART_BEHIND) and at .trackBase + 1.
#   lastX is the watchdog's OWN baseline (.wdX, x10) -- deliberately NOT
#   .cartX: main's per-tick .cartX read is an `execute store result`, and on
#   modern versions a store whose command fails WRITES 0 -- so while the
#   cart is dead/unloaded, .cartX reads 0 every tick, and a target computed
#   from it lands thousands of blocks west in released chunks (where the
#   summon fails forever). .wdX is only ever written while a cart was
#   actually selectable, so it is the true last-known-good position.
#   +3 = "a few rails worth forward" -- ahead of whatever wedged it, small
#   enough that the camera rig (which rides a fixed lead ahead of the cart)
#   only ever skips forward a moment's travel. The .headX - 2 cap keeps the
#   target on BUILT track: when the cart stalled because it outran a paused
#   builder and flew off the track end, the snap lands it back on the last
#   solid rails, where it either resumes (track has grown meanwhile) or hops
#   in place until the builder catches up -- a self-healing loop either way.
#   The .headX - .PACE_CART_BEHIND floor keeps any degenerate last-known X
#   (an upgraded save's fresh 0) inside the corridor the rolling forceload
#   is guaranteed to keep loaded (release only starts ~256 behind the head,
#   which is why .PACE_CART_BEHIND must stay below ~250), so a recovery
#   teleport or summon always lands in loaded chunks.
# No known centerline, no recovery: .lineZ is recorded by begin (and
# back-filled from the live cart by pace_watch on upgraded saves) -- if it
# is STILL unset, any Z we computed would be garbage. Fail closed; the
# watchdog retries every 3 seconds and the back-fill needs just one check
# where the cart is selectable.
execute unless score .lineZ ir = .lineZ ir run return 0
scoreboard players operation .fxX ir = .wdX ir
scoreboard players operation .fxX ir /= .C10 ir
scoreboard players add .fxX ir 3
scoreboard players operation .fxS ir = .headX ir
scoreboard players remove .fxS ir 2
execute if score .fxX ir > .fxS ir run scoreboard players operation .fxX ir = .fxS ir
scoreboard players operation .fxS ir = .headX ir
scoreboard players operation .fxS ir -= .PACE_CART_BEHIND cfg_ride
execute if score .fxX ir < .fxS ir run scoreboard players operation .fxX ir = .fxS ir
scoreboard players operation .fxS ir = .trackBase ir
scoreboard players add .fxS ir 1
execute if score .fxX ir < .fxS ir run scoreboard players operation .fxX ir = .fxS ir

# The physical rail level at the target: the track history records each
# column's EXIT height, and a climbing column's blocks sit one below it, so
# the rail of column i is min(y[i-1], y[i]) (place_up's rule -- same math as
# the test helper checkColumn). .ly presets to .railY so a failed history
# read (pack updated over a live ride: no history) degrades to the current
# rail level instead of garbage.
scoreboard players operation .ly ir = .railY ir
scoreboard players operation .fxI ir = .fxX ir
scoreboard players operation .fxI ir -= .trackBase ir
execute store result storage infinite_rail:cami i int 1 run scoreboard players get .fxI ir
function infinite_rail:cam_get with storage infinite_rail:cami
scoreboard players operation .fxY ir = .ly ir
scoreboard players remove .fxI ir 1
execute store result storage infinite_rail:cami i int 1 run scoreboard players get .fxI ir
function infinite_rail:cam_get with storage infinite_rail:cami
execute if score .ly ir < .fxY ir run scoreboard players operation .fxY ir = .ly ir

# Macro args: absolute doubles. Block center / rail height via x10 fixed
# point and a 0.1 store scale -- (10X+5)*0.1 = X+0.5 exactly, sign-safe
# (a textual "$(x).5" would mis-center on negative X). Y rides 0.1 above
# the rail cell so the cart settles onto the rail instead of clipping it.
# Z is the persisted centerline (.lineZ, recorded by begin after the
# chunk-row snap) -- never read from an entity, see the header note.
scoreboard players operation .fxM ir = .fxX ir
scoreboard players operation .fxM ir *= .C10 ir
scoreboard players add .fxM ir 5
execute store result storage infinite_rail:fix x double 0.1 run scoreboard players get .fxM ir
scoreboard players operation .fxM ir = .fxY ir
scoreboard players operation .fxM ir *= .C10 ir
scoreboard players add .fxM ir 1
execute store result storage infinite_rail:fix y double 0.1 run scoreboard players get .fxM ir
scoreboard players operation .fxM ir = .lineZ ir
scoreboard players operation .fxM ir *= .C10 ir
scoreboard players add .fxM ir 5
execute store result storage infinite_rail:fix z double 0.1 run scoreboard players get .fxM ir

# Recover: snap the existing cart onto the rail, or re-summon a missing one
# (same NBT as begin's summon; the plug below and main's mount keeper
# restore the seat-blocker within a tick). Teleporting a vehicle dismounts
# its passengers, so the plug pops off either way -- main's unconditional
# `ride ... mount` line re-plugs it next tick from any distance.
execute if entity @e[type=minecart,tag=ir_cart,limit=1] run function infinite_rail:pace_fix_tp with storage infinite_rail:fix
execute unless entity @e[type=minecart,tag=ir_cart,limit=1] run function infinite_rail:pace_fix_summon with storage infinite_rail:fix
# Eastward shove (the summon NBT already carries one; the tp'd cart keeps
# whatever dead motion stalled it, so overwrite).
data merge entity @e[type=minecart,tag=ir_cart,limit=1] {Motion:[0.5d,0.0d,0.0d]}
# If the plug went down with the cart, restore it too (invisible, empty
# item_display; the keeper mounts it).
execute unless entity @e[type=item_display,tag=ir_plug,limit=1] at @e[type=minecart,tag=ir_cart,limit=1] run summon minecraft:item_display ~ ~1 ~ {Tags:["ir_plug"]}

# Bookkeeping: measure the next 3-second window from the recovery spot, keep
# the build-gap math honest immediately (main's .cartX read would lag a
# tick), and count the recovery (.wdfixn -- the lifetime counter the tests
# assert on: 0 after a clean ride is the no-false-positives proof).
scoreboard players operation .wdX ir = .fxX ir
scoreboard players operation .wdX ir *= .C10 ir
scoreboard players operation .cartX ir = .fxX ir
scoreboard players add .wdfixn ir 1
execute if score .DEBUGMODE ir matches 1 run tellraw @a [{"text":"[SR Debug] ","color":"dark_aqua"},{"text":"pace cart re-railed at x=","color":"gray"},{"score":{"name":".fxX","objective":"ir"},"color":"white"},{"text":" y=","color":"gray"},{"score":{"name":".fxY","objective":"ir"},"color":"white"},{"text":" (recovery #","color":"gray"},{"score":{"name":".wdfixn","objective":"ir"},"color":"white"},{"text":")","color":"gray"}]
