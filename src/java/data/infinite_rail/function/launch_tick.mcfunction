# Launch phase driver (.started 2), run from tick: extends the pre-ride
# runway a couple dozen columns per tick until the head reaches the goal
# begin set (.pregoal = the rig position + 32: start + .PACE_CART_BEHIND - .RIDER_BEHIND + 32), then finishes the launch
# via launch_done. Building across ticks -- instead of synchronously inside
# begin -- means every tick is its own fresh command chain, so the launch
# can never be silently truncated by the vanilla per-chain command/fork
# budgets no matter how heavy the per-column pipeline or the config gets.
execute store result score .cartX ir run data get entity @e[type=minecart,tag=ir_cart,limit=1] Pos[0] 1
# The chunk roll's phase machine runs during the launch too (the runway's
# rolls trigger from advance exactly like a ride's -- see roll_chunks);
# begin's synchronous forceload_here already covers the whole runway, so
# these phases are cheap no-op re-adds until the ride outgrows it.
execute if score .rollP ir matches 1.. at @e[type=marker,tag=ir_head,limit=1] run function infinite_rail:roll_phase
# Invisible track: the runway columns are invisible too while the mode is
# on -- keep the pace cart's just-in-time rail strip under it during the
# pre-build (free otherwise -- see invis_tick).
function infinite_rail:invis_tick
scoreboard players set .budget ir 24
function infinite_rail:build_loop
execute if score .headX ir >= .pregoal ir run function infinite_rail:launch_done
