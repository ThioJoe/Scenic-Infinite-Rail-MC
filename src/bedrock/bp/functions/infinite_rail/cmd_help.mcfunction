# The Debug menu's command help: a /scoreboard cheat sheet, since the exact
# spelling is easy to forget. (Bedrock rawtext has no clickable commands, so
# these are plain lines to copy from.)
tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Scoreboard cheat sheet:"}]}
tellraw @a {"rawtext":[{"text":"§7  tweak a value live:  §b/scoreboard players set .HOVER cfg_terrain 8"}]}
tellraw @a {"rawtext":[{"text":"§7  show a group:  §b/scoreboard objectives setdisplay sidebar cfg_camera"}]}
tellraw @a {"rawtext":[{"text":"§7  hide sidebar:  §b/scoreboard objectives setdisplay sidebar"}]}
tellraw @a {"rawtext":[{"text":"§7  objectives: §fcfg_terrain cfg_camera cfg_ride§7 (settings; live tweaks reset on /reload), §fir§7 (runtime state), §fdbg§7 (the Live state sidebar mirror)"}]}
