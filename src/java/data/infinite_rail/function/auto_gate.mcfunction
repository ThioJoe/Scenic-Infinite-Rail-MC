# Auto-start world-age gate. Called from tick ONCE, on the first tick a player
# appears in an armed auto-start world (before the 5-second countdown begins).
# Reads the world's total game time; if this looks like an EXISTING/played
# world (older than .WORLDAGEWARN minutes) it blocks the auto-start and warns
# the player (auto_aged) instead of bulldozing their world out from under
# them. A manual /function infinite_rail:start is unaffected -- it never
# consults .autodone.
#
# WHY ITS OWN FILE: `time query gametime` is the one mildly version-risky line
# here, and a command that fails to compile kills its whole file at load. Kept
# alone, a hypothetical failure only costs the age check (the countdown then
# runs as before -- fail-open), never the rest of the tick.
#
# .WORLDAGEWARN is in MINUTES; one minute is 1200 ticks (.C1200). .worldAge is
# preset to 0 so a version that somehow can't answer the query reads as a
# fresh world (auto-start as before) rather than blocking every world.
scoreboard players set .worldAge ir 0
execute store result score .worldAge ir run time query gametime
scoreboard players operation .ageThresh ir = .WORLDAGEWARN ir
scoreboard players operation .ageThresh ir *= .C1200 ir
# The `.WORLDAGEWARN matches 1..` re-check makes this self-contained: with the
# guard off (0) the threshold is 0 and every world would read as "aged"
# (gametime >= 0). The tick caller already gates on it, but auto_gate must not
# depend on that -- 0 means disabled, here as everywhere.
execute if score .WORLDAGEWARN ir matches 1.. if score .worldAge ir >= .ageThresh ir run function infinite_rail:auto_aged
