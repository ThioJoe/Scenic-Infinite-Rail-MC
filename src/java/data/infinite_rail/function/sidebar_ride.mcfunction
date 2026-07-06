# Debug menu: show the ride-settings group (cfg_ride -- speed, mode knobs,
# performance) on the scoreboard sidebar (see sidebar_terrain).
scoreboard objectives setdisplay sidebar cfg_ride
scoreboard players set .SIDEBAR ir 3
tellraw @a [{"text":"[Infinite Rail] ","color":"gold"},{"text":"Sidebar: ride settings.","color":"gray"}]
