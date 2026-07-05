# The Settings book's click dispatcher, run from tick EVERY tick (ride or
# no ride, so a click can never sit stale in the objective).
#
# WHY /trigger: since 1.21.6, clicking a run_command link that needs
# elevated permissions (like /function) pops a "command requires elevated
# permissions" confirmation screen on every single click -- even for
# operators. /trigger is the one command every player may run at permission
# level 0, so the book's links only ever do  `trigger ir_menu set <n>`  (no
# confirmation, no operator requirement), and this dispatcher turns the
# number into the real mode call, executed at function permission level.
execute as @a[scores={ir_menu=1}] run function infinite_rail:mode_rain_on
execute as @a[scores={ir_menu=2}] run function infinite_rail:mode_rain_off
execute as @a[scores={ir_menu=3}] run function infinite_rail:mode_night_on
execute as @a[scores={ir_menu=4}] run function infinite_rail:mode_night_off
execute as @a[scores={ir_menu=5}] run function infinite_rail:mode_torches_on
execute as @a[scores={ir_menu=6}] run function infinite_rail:mode_torches_off
execute as @a[scores={ir_menu=7}] run function infinite_rail:mode_sky_on
execute as @a[scores={ir_menu=8}] run function infinite_rail:mode_sky_off
execute as @a[scores={ir_menu=9}] run function infinite_rail:modes
# Consume the click and re-arm the trigger for everyone (a trigger objective
# disables itself for a player after each use, and reset drops the enabled
# flag with the score -- so both lines run, in this order, every tick).
scoreboard players reset @a ir_menu
scoreboard players enable @a ir_menu
