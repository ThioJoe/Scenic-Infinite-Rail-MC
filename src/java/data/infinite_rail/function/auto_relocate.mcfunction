# Auto-start's westward relocation, run `as` the starting player the tick
# the countdown begins (tick.mcfunction, .start_timer 1): teleport them to
# X = -99000 (keeping their Z) so the ride starts deep in negative X and
# spends the maximum time at LOW absolute coordinates. The reason is
# Bedrock's 32-bit floating-point positions -- precision decays with |X|,
# so starting at -99,000 doubles the runway spent within five significant
# figures (|X| <= 99k: ~6.9 hours of continuous riding at the default
# 8 blocks/s, vs ~3.4 from a spawn near zero) -- and Java mirrors it for
# cross-edition parity (its own limit, the camera's x1000 fixed-point
# scoreboard math at ~±2.1 million, only gains margin). Keep the value in
# step with START_X in the Bedrock script (main.js); it is a literal here
# because /tp cannot read a scoreboard.
#
# FRESH WORLDS ONLY by construction: the countdown this hangs off only runs
# while .autodone is unset -- a world whose ride ever started (or that the
# world-age gate declined) never relocates, so a manual restart resumes
# where the rider stands instead of yanking them 99k west and rewinding
# the journey.
#
# The player falls from Y 320 (above the build limit -- no terrain can
# swallow the teleport target) while the countdown runs and the chunks
# beneath them generate; the ride's damage gamerules aren't applied until
# begin runs setup_world, so a 30-second Resistance 255 makes the landing
# (and any suffocation while terrain streams in) harmless. begin's launch
# lifts them onto the rail line regardless of where they came to rest.
effect give @s minecraft:resistance 30 255 true
execute at @s run tp @s -99000 320 ~
