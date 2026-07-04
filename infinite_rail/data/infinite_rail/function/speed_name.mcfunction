# Detects the 1.21-era minecart max-speed gamerule name into storage
# infinite_rail:speed rule. Called once from load.
#
# VERSION SPLIT (like setup_world / setup_world_26): the guard line below is a
# never-true execute whose only purpose is to make the game validate the
# camelCase gamerule name at LOAD time. On 26.x-era versions that name is
# unknown, so this WHOLE file fails to compile and is dropped -- leaving
# speed_name_26 to set the snake_case name instead. #C1000 is 1000, never 0, so
# the guarded gamerule never actually runs.
execute if score #C1000 ir matches 0 run gamerule minecartMaxSpeed 8
data modify storage infinite_rail:speed rule set value "minecartMaxSpeed"
