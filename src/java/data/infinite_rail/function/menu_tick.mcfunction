# The Settings/Debug books' click dispatcher, run from tick EVERY tick (ride
# or no ride, so a click can never sit stale in the objective).
#
# WHY /trigger: since 1.21.6, clicking a run_command link that needs
# elevated permissions (like /function) pops a "command requires elevated
# permissions" confirmation screen on every single click -- even for
# operators. /trigger is the one command every player may run at permission
# level 0, so the books' links only ever do  `trigger ir_menu set <n>`  (no
# confirmation, no operator requirement), and this dispatcher turns the
# number into the real call at function permission level.
#
# The number map (give_menu writes these into the books' links):
#   1/2      rain on/off                 13        speed reset (11/12 were the
#   3/10/4   time night/day/default                book's old -/+ links, retired:
#   5/6      torches on/off                        the hotbar items cover it)
#   7/8      sky on/off                  14/15     debug chat on/off
#   9        modes printout              16-19     sidebar terrain/camera/
#   22-25    torch density                         ride/live-state
#            low/medium/high/max         20/21     sidebar off / command help
#   26/27    hide cart on/off            28/29     minecart sound on/off
execute as @a[scores={ir_menu=1}] run function infinite_rail:mode_rain_on
execute as @a[scores={ir_menu=2}] run function infinite_rail:mode_rain_off
execute as @a[scores={ir_menu=3}] run function infinite_rail:mode_night_on
execute as @a[scores={ir_menu=4}] run function infinite_rail:mode_night_off
execute as @a[scores={ir_menu=5}] run function infinite_rail:mode_torches_on
execute as @a[scores={ir_menu=6}] run function infinite_rail:mode_torches_off
execute as @a[scores={ir_menu=7}] run function infinite_rail:mode_sky_on
execute as @a[scores={ir_menu=8}] run function infinite_rail:mode_sky_off
execute as @a[scores={ir_menu=9}] run function infinite_rail:modes
execute as @a[scores={ir_menu=10}] run function infinite_rail:mode_day_on
execute as @a[scores={ir_menu=13}] run function infinite_rail:speed_reset
execute as @a[scores={ir_menu=14}] run function infinite_rail:debug
execute as @a[scores={ir_menu=15}] run function infinite_rail:debug_off
execute as @a[scores={ir_menu=16}] run function infinite_rail:sidebar_terrain
execute as @a[scores={ir_menu=17}] run function infinite_rail:sidebar_camera
execute as @a[scores={ir_menu=18}] run function infinite_rail:sidebar_ride
execute as @a[scores={ir_menu=19}] run function infinite_rail:sidebar_state
execute as @a[scores={ir_menu=20}] run function infinite_rail:sidebar_off
execute as @a[scores={ir_menu=21}] run function infinite_rail:cmd_help
execute as @a[scores={ir_menu=22}] run function infinite_rail:torch_density_low
execute as @a[scores={ir_menu=23}] run function infinite_rail:torch_density_medium
execute as @a[scores={ir_menu=24}] run function infinite_rail:torch_density_high
execute as @a[scores={ir_menu=25}] run function infinite_rail:torch_density_max
execute as @a[scores={ir_menu=26}] run function infinite_rail:mode_hidecart_on
execute as @a[scores={ir_menu=27}] run function infinite_rail:mode_hidecart_off
execute as @a[scores={ir_menu=28}] run function infinite_rail:mode_sound_on
execute as @a[scores={ir_menu=29}] run function infinite_rail:mode_sound_off
# The Speed hotbar items' clicks: the carrot_on_a_stick "used" statistic
# (ir_click, a stat-criteria objective) fans out to speed_click, which reads
# the held item's custom_data to tell + from - and resets the count.
execute as @a[scores={ir_click=1..}] run function infinite_rail:speed_click
# Consume the click and re-arm the trigger for everyone (a trigger objective
# disables itself for a player after each use, and reset drops the enabled
# flag with the score -- so both lines run, in this order, every tick).
scoreboard players reset @a ir_menu
scoreboard players enable @a ir_menu
