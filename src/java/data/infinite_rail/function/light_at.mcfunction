# Macro: places the track light 3 above the rail at the level from storage
# infinite_rail:light (set by place_light -- block states can't be read from
# a scoreboard, so the level arrives as a macro argument).
$setblock ~ ~3 ~ minecraft:light[level=$(l)]
