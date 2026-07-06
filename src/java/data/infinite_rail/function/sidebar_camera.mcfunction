# Debug menu: show the camera-settings group (cfg_camera) on the scoreboard
# sidebar (see sidebar_terrain for the grouping rationale).
scoreboard objectives setdisplay sidebar cfg_camera
scoreboard players set .SIDEBAR ir 2
tellraw @a [{"text":"[Infinite Rail] ","color":"gold"},{"text":"Sidebar: camera settings. Tweak one live, e.g. ","color":"gray"},{"text":"/scoreboard players set .CAMLIFT cfg_camera 25","color":"aqua","click_event":{"action":"suggest_command","command":"/scoreboard players set .CAMLIFT cfg_camera 25"}}]
