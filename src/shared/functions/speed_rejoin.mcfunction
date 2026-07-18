# The world-rejoin unpark check (both editions). A ride parked at speed 0
# (stop-and-reverse: 0 is a legal, persisted cruise value) survives quitting
# the world -- so a player who forgot they stopped the cart rejoins to a ride
# that sits still and looks broken. This one-shot check runs from each
# edition's native rejoin path (Java: rejoin_check -- armed by load on EVERY
# (re)load, since Java has no join event and a singleplayer world open has
# the host already online when the load hook runs, so a rejoin cannot be
# told from a /reload -- fired by tick once a player is targetable; Bedrock:
# the script's playerSpawn handler through its own rejoin_check wrapper,
# which /reload does NOT re-fire -- each edition uses its natural join
# signal): if the
# ACTIVE cruise speed is EXACTLY 0, return it to its own config default --
# the land speed to .DEFAULTSPEED, the ocean cruise (.fast 1) to .OCEANSPEED,
# the sky cruise (.SKYMODE 1) to .SKYSPEED -- exactly the value the Speed
# Reset item would land on. A NEGATIVE (reversing) speed is left alone: a
# ride visibly rolling backwards was deliberate and doesn't read as broken.
#
# Output: .spfix (ir)  --  1 = the active cruise was parked and has been
#                          reset (.spcur holds the new value; the native
#                          caller applies/report it -- Java pushes the
#                          gamerule via speed_push and prints, Bedrock only
#                          prints: its virtual pace reads the scores live).
#                          0 = nothing to do.
#         .spcur (ir)  --  the active cruise speed after the check.
#
# The active-cruise selection mirrors the shared speed_step exactly: sky mode
# wins, then the ocean sprint, else land. A 0 config default (e.g. .OCEANSPEED
# 0 = the ocean feature disabled) never "fixes" a parked ride to 0 -- the
# check only fires when the default itself is positive.
scoreboard players set .spfix ir 0
scoreboard players operation .spcur ir = .speed ir
scoreboard players operation .spdef ir = .DEFAULTSPEED cfg_ride
execute unless score .SKYMODE ir matches 1 if score .fast ir matches 1 run scoreboard players operation .spcur ir = .ocnspd ir
execute unless score .SKYMODE ir matches 1 if score .fast ir matches 1 run scoreboard players operation .spdef ir = .OCEANSPEED cfg_ride
execute if score .SKYMODE ir matches 1 run scoreboard players operation .spcur ir = .skyspd ir
execute if score .SKYMODE ir matches 1 run scoreboard players operation .spdef ir = .SKYSPEED cfg_ride
execute if score .spcur ir matches 0 if score .spdef ir matches 1.. run scoreboard players set .spfix ir 1
execute if score .spfix ir matches 1 run scoreboard players operation .spcur ir = .spdef ir
# Write the restored value back to whichever cruise is active (the same
# write-back split as speed_step; the other two cruises stay untouched).
execute if score .spfix ir matches 1 unless score .SKYMODE ir matches 1 unless score .fast ir matches 1 run scoreboard players operation .speed ir = .spcur ir
execute if score .spfix ir matches 1 unless score .SKYMODE ir matches 1 if score .fast ir matches 1 run scoreboard players operation .ocnspd ir = .spcur ir
execute if score .spfix ir matches 1 if score .SKYMODE ir matches 1 run scoreboard players operation .skyspd ir = .spcur ir
