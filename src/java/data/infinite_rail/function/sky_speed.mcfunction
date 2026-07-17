# Applies the current SKY cruising speed (.skyspd) to the minecart max-speed
# gamerule. .skyspd is adjustable state seeded from the config default
# .SKYSPEED (the Speed +/- items and Reset tune it while sky mode is on -- see
# the shared speed_step), so sky mode jumps to its default on first use but is
# adjustable from there. Split out of mode_sky_on because begin re-applies it
# too: a ride started while sky mode is already on must not launch at the land
# speed.
scoreboard players operation .spush ir = .skyspd ir
function infinite_rail:speed_push
