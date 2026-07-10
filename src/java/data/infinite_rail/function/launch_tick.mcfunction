# Launch phase driver (.started 2), run from tick: extends the pre-ride
# runway a couple dozen columns per tick until the head reaches the goal
# begin set (.pregoal = the rig position + 32: start + .PACE_CART_BEHIND - .RIDER_BEHIND + 32), then finishes the launch
# via launch_done. Building across ticks -- instead of synchronously inside
# begin -- means every tick is its own fresh command chain, so the launch
# can never be silently truncated by the vanilla per-chain command/fork
# budgets no matter how heavy the per-column pipeline or the config gets.
execute store result score .cartX ir run data get entity @e[type=minecart,tag=ir_cart,limit=1] Pos[0] 1
scoreboard players set .budget ir 24
function infinite_rail:build_loop
execute if score .headX ir >= .pregoal ir run function infinite_rail:launch_done
