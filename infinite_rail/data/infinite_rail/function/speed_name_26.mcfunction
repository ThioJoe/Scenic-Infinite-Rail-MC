# 26.x-era twin of speed_name (25w44a renamed the gamerule to snake_case).
# Detects the snake_case minecart max-speed gamerule name into storage
# infinite_rail:speed rule. Called once from load.
#
# The guard validates the snake_case name at load; on 1.21-era versions it is
# unknown, so this file is dropped and speed_name sets the camelCase name
# instead. #C1000 is 1000, never 0, so the guarded gamerule never actually runs.
execute if score #C1000 ir matches 0 run gamerule max_minecart_speed 8
data modify storage infinite_rail:speed rule set value "max_minecart_speed"
