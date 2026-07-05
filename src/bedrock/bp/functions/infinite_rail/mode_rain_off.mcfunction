# Mode toggle:  /function infinite_rail/mode_rain_off
# Back to default weather: the vanilla weather cycle resumes and the current
# rain is cleared.
scoreboard players set .RAINMODE ir 0
gamerule doweathercycle true
weather clear
tellraw @a {"rawtext":[{"text":"§6[Infinite Rail]§r §7Rain mode OFF - normal weather restored."}]}
