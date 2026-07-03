# Begins a climb or descent in direction #want. This column becomes the first
# sloped column of the event; the event will keep sloping (via decide) every
# following column until it reaches the target elevation.
scoreboard players operation #dir ir = #want ir
scoreboard players operation #slope ir = #want ir
scoreboard players operation #lastDir ir = #want ir
scoreboard players set #flat ir 0
