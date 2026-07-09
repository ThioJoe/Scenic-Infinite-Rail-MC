# The track/tunnel light above the rail (railY+3), at the level chosen by
# the Track light mode (.LIGHTMODE -- mode_light_on/low/off, or the Visual
# Settings menu): 11 = the classic bright line (the default, and the
# ice-melt-safe maximum), 8 = a dim glow, 0 = no light at all (dark tunnels
# and nights -- hostile mobs can spawn in unlit tunnels). Any hand-set 1..15
# works too; setblock block states can't come from a scoreboard, so the
# level hops through storage into the light_at macro. Runs positioned at the
# head (called by place_flat/up/down) and applies to NEW columns only --
# built track keeps whatever it was built with, like torch mode.
execute if score .LIGHTMODE ir matches 1..15 store result storage infinite_rail:light l int 1 run scoreboard players get .LIGHTMODE ir
execute if score .LIGHTMODE ir matches 1..15 run function infinite_rail:light_at with storage infinite_rail:light
