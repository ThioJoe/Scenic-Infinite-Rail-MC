# Mode toggle:  /function infinite_rail:mode_light_off
# Track light: off -- no light block above new track at all. Tunnels bore
# dark, nights stay dark, and hostile mobs can spawn in the unlit tunnels
# the ride leaves behind. New columns only; the already-built line keeps its
# lights.
scoreboard players set .LIGHTMODE ir 0
tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Track light OFF - new track is built dark.","color":"gray"}]
