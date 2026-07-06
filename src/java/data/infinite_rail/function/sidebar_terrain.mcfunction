# Debug menu: show the terrain-settings group (cfg_terrain) on the scoreboard
# sidebar. A vanilla sidebar displays ONE objective (max 15 rows), which is
# why the 30+ knobs are split into three groups and the Debug book switches
# between them (and the Live state view) instead of showing everything at
# once. .SIDEBAR remembers the choice (0 off, 1-3 the cfg groups, 4 state).
scoreboard objectives setdisplay sidebar cfg_terrain
scoreboard players set .SIDEBAR ir 1
tellraw @a [{"text":"[Infinite Rail] ","color":"gold"},{"text":"Sidebar: terrain settings.","color":"gray"}]
