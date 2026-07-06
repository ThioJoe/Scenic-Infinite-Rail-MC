# Debug menu: clear the scoreboard sidebar (and stop the per-tick Live state
# mirror -- .SIDEBAR 0 gates debug_tick off).
scoreboard objectives setdisplay sidebar
scoreboard players set .SIDEBAR ir 0
tellraw @a [{"text":"[Infinite Rail] ","color":"gold"},{"text":"Sidebar hidden.","color":"gray"}]
