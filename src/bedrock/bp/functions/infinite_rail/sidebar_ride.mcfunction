# Debug menu: show the ride-settings group (cfg_ride -- speed, mode knobs,
# performance) on the scoreboard sidebar (see sidebar_terrain).
scoreboard objectives setdisplay sidebar cfg_ride
scoreboard players set .SIDEBAR ir 3
tellraw @a {"rawtext":[{"text":"§6[Infinite Rail]§r §7Sidebar: ride settings. Tweak one live, e.g. §b/scoreboard players set .OCEANSPEED cfg_ride 32"}]}
