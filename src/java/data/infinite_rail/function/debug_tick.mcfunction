# Refreshes the "Live state" sidebar (the display-only `dbg` objective) --
# run from tick once per tick while that view is selected (.SIDEBAR 4, set
# by sidebar_state). The ten shared-brain scores go through the shared
# debug_state (the same file Bedrock's ticker runs); the five Java-native
# ones are mirrored here. 15 rows total -- the sidebar maximum.
function infinite_rail:debug_state
scoreboard players operation .headX dbg = .headX ir
scoreboard players operation .gap dbg = .gap ir
scoreboard players operation .avg dbg = .avg ir
scoreboard players operation .fast dbg = .fast ir
scoreboard players operation .started dbg = .started ir
