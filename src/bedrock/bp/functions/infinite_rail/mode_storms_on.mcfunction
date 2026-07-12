# Mode toggle:  /function infinite_rail/mode_storms_on
# Thunderstorms allowed -- the vanilla default: stands the No-Thunderstorms
# watch down (the script's weatherChange watch -- see main.js). NOTE the
# user-facing name: the pair is named for the question "storms on or off?",
# so storms ON means the watch is OFF -- this CLEARS .STORMMODE (1 = storms
# suppressed; see mode_storms_off). World state like rain mode: works with
# or without a ride running and sticks across reloads and rejoins.
scoreboard players set .STORMMODE ir 0
tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Thunderstorms ON - storms can roll in with the natural weather."}]}
