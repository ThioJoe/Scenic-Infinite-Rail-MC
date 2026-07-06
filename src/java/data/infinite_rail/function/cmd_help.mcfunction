# The Debug book's [Command help] link: a /scoreboard cheat sheet, since the
# exact spelling is easy to forget. Clicking any example puts it into the
# chat bar (suggest_command) ready to edit -- none of them run directly.
tellraw @a [{"text":"[Infinite Rail] ","color":"gold"},{"text":"Scoreboard cheat sheet - click a command to prefill it:","color":"gray"}]
tellraw @a [{"text":"  read a value:  ","color":"gray"},{"text":"/scoreboard players get .HOVER cfg_terrain","color":"aqua","click_event":{"action":"suggest_command","command":"/scoreboard players get .HOVER cfg_terrain"}}]
tellraw @a [{"text":"  tweak it live:  ","color":"gray"},{"text":"/scoreboard players set .HOVER cfg_terrain 8","color":"aqua","click_event":{"action":"suggest_command","command":"/scoreboard players set .HOVER cfg_terrain 8"}}]
tellraw @a [{"text":"  show a group:  ","color":"gray"},{"text":"/scoreboard objectives setdisplay sidebar cfg_camera","color":"aqua","click_event":{"action":"suggest_command","command":"/scoreboard objectives setdisplay sidebar cfg_camera"}}]
tellraw @a [{"text":"  hide sidebar:  ","color":"gray"},{"text":"/scoreboard objectives setdisplay sidebar","color":"aqua","click_event":{"action":"suggest_command","command":"/scoreboard objectives setdisplay sidebar"}}]
tellraw @a [{"text":"  objectives: ","color":"gray"},{"text":"cfg_terrain cfg_camera cfg_ride","color":"white"},{"text":" (settings; live tweaks reset on /reload), ","color":"gray"},{"text":"ir","color":"white"},{"text":" (runtime state), ","color":"gray"},{"text":"dbg","color":"white"},{"text":" (the Live state sidebar's mirror)","color":"gray"}]
