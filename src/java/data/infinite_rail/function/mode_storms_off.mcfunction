# Mode toggle:  /function infinite_rail:mode_storms_off
# No thunderstorms: while .STORMMODE is 1 the tick hook runs storm_watch,
# which swaps a natural thunderstorm for plain rain the moment it starts
# (the replacement rain gets vanilla's usual random duration, so the sky
# still clears on its own). Only the NATURAL cycle is watched: permanent
# rain (mode_rain_on) freezes the cycle and only ever rains, so the tick
# hook stands down while it is on. NOTE the user-facing name: the pair is
# named for the question "storms on or off?", so storms OFF means the
# watcher is ON -- this SETS .STORMMODE. World state like rain mode: works
# with or without a ride running and sticks across /reload and rejoins.
scoreboard players set .STORMMODE ir 1
tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Thunderstorms OFF - storms will pass as plain rain.","color":"gray"}]
# load's self-test (storm_check) found the thundering predicate broken on
# this version: the watcher can't see storms, so say so at the moment the
# player asks for the feature instead of silently doing nothing.
execute if score .stormok ir matches 0 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Warning: the thunderstorm check is not working on this Minecraft version, so storms cannot be detected and switched to rain. Please report this with your exact game version.","color":"yellow"}]
