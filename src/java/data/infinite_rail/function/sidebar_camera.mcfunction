# Debug menu: show the camera-settings group (cfg_camera) on the scoreboard
# sidebar (see sidebar_terrain for the grouping rationale).
scoreboard objectives setdisplay sidebar cfg_camera
scoreboard players set .SIDEBAR ir 2
tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Sidebar: camera settings.","color":"gray"}]
