# The world-rejoin unpark check's Java dispatcher, run ONCE by tick on the
# first tick a player is targetable while .rejchk is armed. load arms the
# flag on EVERY (re)load: vanilla Java has no join event, and on a
# singleplayer world open the host player is already online when the load
# hook runs, so a rejoin cannot be distinguished from a mid-session /reload
# (see load.mcfunction -- a /reload therefore also re-runs this check; that
# is deliberate, and the message below says exactly what happened).
#
# The decision itself is the shared speed_rejoin (see its header): if the
# ACTIVE cruise speed persisted as exactly 0 (parked -- stop-and-reverse
# state), it is returned to that cruise's config default. Here that result
# is applied natively: the minecart max-speed gamerule gets the magnitude
# (speed_push -- same as every speed change), and the rider is told why the
# ride is moving again.
scoreboard players set .rejchk ir 0
scoreboard players set .spfix ir 0
# Only a resumed ride can be "stuck parked" -- a stopped world (.started 0)
# keeps whatever speed it saved; a fresh start normalizes <= 0 in begin.
execute if score .started ir matches 1.. run function infinite_rail:speed_rejoin
execute if score .spfix ir matches 1 run scoreboard players operation .spush ir = .spcur ir
execute if score .spfix ir matches 1 run function infinite_rail:speed_push
execute if score .spfix ir matches 1 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"The ride was parked at speed 0 last session -- resuming at the default ","color":"gray"},{"score":{"name":".spcur","objective":"ir"},"color":"white"},{"text":" blocks/s.","color":"gray"}]
