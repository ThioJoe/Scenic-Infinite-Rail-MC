# Debug menu: show the ride-settings group (cfg_ride -- speed, mode knobs,
# performance) on the scoreboard sidebar (see sidebar_terrain).
scoreboard objectives setdisplay sidebar cfg_ride
scoreboard players set .SIDEBAR ir 3
tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Sidebar: ride settings."}]}
