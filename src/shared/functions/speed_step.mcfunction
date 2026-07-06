# The adjustable ride speed's shared state machine (both editions).
#
# Input:  .spdir (ir)  --  the change in blocks/s: positive = faster,
#                          negative = slower (speed_inc/speed_dec pass
#                          +/-.SPEEDSTEP from the shared consts.mcfunction;
#                          Bedrock's settings slider passes an exact delta),
#                          0 = reset to the config default.
# Output: .speed (ir)  --  the ride's LAND cruising speed. STATE, not
#                          config: it survives /reload, ride restarts and
#                          rejoins (seeded from .MAXSPEED by modes_init the
#                          first time, reset only by the menu's Reset).
#         .spdflt (ir) --  1 = the new speed equals the config default
#                          .MAXSPEED (the caller's message appends
#                          "(default)").
#
# Floored at 1; there is deliberately NO upper cap -- keep clicking Speed +
# for as long as you dare (Java's minecart max-speed gamerule enforces
# whatever bound vanilla itself has; Bedrock's virtual pace takes any value,
# though past a point the builder can't lay track fast enough and the pace
# soft-ceiling eases the ride off to the track buffer). The APPLY is native
# per edition: Java pushes .speed into the minecart max-speed gamerule
# (speed_apply); Bedrock's script reads .speed as the virtual pace target
# every tick. Reached from the Speed +/- hotbar items, the Settings menu's
# speed controls, and the speed_inc / speed_dec / speed_reset chat functions.
execute if score .spdir ir matches 0 run scoreboard players operation .speed ir = .MAXSPEED cfg_ride
scoreboard players operation .speed ir += .spdir ir
scoreboard players set .sclamp ir 1
scoreboard players operation .speed ir > .sclamp ir
scoreboard players set .spdflt ir 0
execute if score .speed ir = .MAXSPEED cfg_ride run scoreboard players set .spdflt ir 1
