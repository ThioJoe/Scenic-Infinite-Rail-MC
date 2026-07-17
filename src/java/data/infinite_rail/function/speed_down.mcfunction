# Return to land after an ocean sprint. Called by ocean_check once, on the
# transition back (after .LANDCHUNKS non-ocean chunks).
#
# RAISE-ONLY on the way out too -- the return to land must never slow a rider
# who is going fast. The cruise we were just doing is .ocnspd (the active
# speed while the sprint owned the ride; re-asserted every ocean chunk and
# updated by any mid-sprint Speed click):
#   - If .ocnspd is ABOVE the base ocean speed .OCEANSPEED -- the rider came in
#     faster than the ocean speed, or sped up mid-sprint -- keep that speed on
#     land (.speed becomes it). Do not slow down.
#   - Otherwise (the ocean speed or below) restore the pre-ocean land speed,
#     which .speed still holds untouched from the entry.
# Either way the land speed is then hand-tweakable again, and Reset returns it
# to the true default .DEFAULTSPEED (the "reset speed" is the config default on
# land, the ocean speed during the sprint -- managed by the context, not the
# speed the rider happens to be at).
execute if score .ocnspd ir > .OCEANSPEED cfg_ride run scoreboard players operation .speed ir = .ocnspd ir
scoreboard players operation .spush ir = .speed ir
function infinite_rail:speed_push
execute if score .DEBUGMODE ir matches 1 run tellraw @a [{"text":"[SR Debug] ","color":"dark_aqua"},{"text":"returning to land, speed ","color":"yellow"},{"score":{"name":".speed","objective":"ir"},"color":"white"}]
scoreboard players set .fast ir 0
