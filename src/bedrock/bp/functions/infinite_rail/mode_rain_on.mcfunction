# Mode toggle:  /function infinite_rail/mode_rain_on
# Permanent rain: freezes the vanilla weather cycle (so the rain can never
# time out) and starts it raining. World state, not ride state -- it works
# with or without a ride running, sticks across /reload and rejoins, and
# stacks with the other modes (rain + night is the storm ride).
# (Bedrock gamerule names are stable lowercase, so they're plain literals
# here; Java needs a version-picked name via names.mcfunction + set_rule.)
scoreboard players set .RAINMODE ir 1
gamerule doweathercycle false
weather rain
tellraw @a {"rawtext":[{"text":"§6[Infinite Rail]§r §7Rain mode ON - permanent rain. §b/function infinite_rail/mode_rain_off§7 restores normal weather."}]}
