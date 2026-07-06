# Debug menu: clear the scoreboard sidebar (and stop the per-tick Live state
# mirror -- .SIDEBAR 0 gates it off).
scoreboard objectives setdisplay sidebar
scoreboard players set .SIDEBAR ir 0
tellraw @a {"rawtext":[{"text":"§6[Infinite Rail]§r §7Sidebar hidden."}]}
