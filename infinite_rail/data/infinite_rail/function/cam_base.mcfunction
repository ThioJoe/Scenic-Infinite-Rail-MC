# One-time calibration, run AS the rider while they sit in the real cart on
# flat track: #seatBase = how many milliblocks a cart passenger sits above the
# rail line. Seat mode adds the same offset, so mode switches are seamless and
# #CAMHEIGHT 0 means "exactly the normal in-cart view". Measured fresh on
# every ride rather than hardcoded, since the offset depends on game version
# and cart physics (e.g. the minecart_improvements experiment).
execute store result score #py ir run data get entity @s Pos[1] 1000
scoreboard players operation #seatBase ir = #py ir
scoreboard players operation #seatBase ir -= #linem ir
scoreboard players set #sbOk ir 1
# Sanity: a passenger sits within a block of the rail line. Anything else
# means the mount hadn't settled yet -- try again next tick.
execute unless score #seatBase ir matches -200..1200 run scoreboard players set #sbOk ir 0
