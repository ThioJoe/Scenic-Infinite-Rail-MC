# Chooses this column's vertical move (#dir: -1 down, 0 flat, 1 up) using the
# "event" model. An event is a single continuous run of ascending OR descending
# columns -- a straight 45-degree line, corner to corner, of any length. The
# rail is NEVER stair-stepped (up, flat, up, flat); it either holds a level or
# slopes cleanly until it reaches the target elevation.
#
# #slope is the direction of the event in progress (0 = running flat).
# Once an event starts it continues every column, at 45 degrees, until the
# target is reached. Only when flat do the spacing gaps get a say in whether a
# new event may begin.
scoreboard players set #dir ir 0
scoreboard players operation #diff ir = #target ir
scoreboard players operation #diff ir -= #railY ir
scoreboard players operation #slope0 ir = #slope ir

# --- Continue an in-progress climb/descent until it reaches the target ---
execute if score #slope0 ir matches 1 if score #diff ir matches 1.. run scoreboard players set #dir ir 1
execute if score #slope0 ir matches 1 if score #diff ir matches ..0 run function infinite_rail:end_event
execute if score #slope0 ir matches -1 if score #diff ir matches ..-1 run scoreboard players set #dir ir -1
execute if score #slope0 ir matches -1 if score #diff ir matches 0.. run function infinite_rail:end_event

# --- If currently flat, decide whether to begin a new event ---
execute if score #slope0 ir matches 0 run function infinite_rail:consider_start
