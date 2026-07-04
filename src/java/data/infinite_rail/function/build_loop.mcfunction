# Builds columns while the head is closer than #AHEAD blocks to the cart
# and this tick's budget is not exhausted.
scoreboard players operation #gap ir = #headX ir
scoreboard players operation #gap ir -= #cartX ir
execute if score #budget ir matches 1.. if score #gap ir < #AHEAD ir run function infinite_rail:build_step
