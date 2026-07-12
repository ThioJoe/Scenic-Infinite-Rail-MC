# Mode toggle:  /function infinite_rail/mode_storms_off
# No thunderstorms: while .STORMMODE is 1 the script's weatherChange watch
# (main.js) swaps a natural thunderstorm for plain rain the moment it rolls
# in; the replacement rain gets vanilla's usual random duration, so the
# weather keeps cycling naturally (the sky just never thunders). Only the
# NATURAL cycle is watched: permanent rain (mode_rain_on) freezes the cycle
# and only ever rains, so the watch stands down while it is on. NOTE the
# user-facing name: the pair is named for the question "storms on or off?",
# so storms OFF means the watch is ON -- this SETS .STORMMODE. World state
# like rain mode: works with or without a ride running and sticks across
# reloads and rejoins.
scoreboard players set .STORMMODE ir 1
tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Thunderstorms OFF - storms will pass as plain rain."}]}
