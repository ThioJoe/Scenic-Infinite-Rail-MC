# The chunk roll's phase machine -- the spread-out half of roll_chunks
# (which see for the split's rationale and measurements). Runs positioned
# at the head, one slice per ODD .rollP value at 2-tick spacing (the even
# values are breather ticks), driven from main (.started 1) and launch_tick
# (.started 2) -- so a missing head pauses a cycle exactly like it pauses
# building, and the cycle resumes when the head is selectable again.
# Slices, in dependency order (the builder needs the corridor first):
#   1: track band, CENTER chunk row (+ the .flok health signal + warning)
#   3: track band, north neighbor row
#   5: track band, south neighbor row
#   7: the torch stub (torch_width -> roll_stub)
#   9: setworldspawn/spawnpoint roll forward; the cycle ends
# The three thin one-block-deep row adds cover exactly the rows the old
# one-command ±15 box covered (see roll_add_row); each queues ~1 fresh
# chunk of generation per roll instead of all 3 in one tick.
#
# .flok is preset 0 BEFORE the phase-1 call and store-successed INSIDE
# roll_add_center, so a roll_add_center/roll_row file that fails to load on
# some game version leaves the 0 behind and still trips the one-shot
# warning below -- the same two-file protection the old
# roll_chunks/forceload_here split had. Re-arms after the next success, so
# a transient failure can warn again later.
execute if score .rollP ir matches 1 run scoreboard players set .flok ir 0
execute if score .rollP ir matches 1 run function infinite_rail:roll_add_center
execute if score .rollP ir matches 1 if score .flok ir matches 0 unless score .flwarn ir matches 1 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Warning: chunk force-loading is failing, so terrain cannot be prepared ahead of the ride (track building will pause at the loaded edge). Please report this with your exact Minecraft version.","color":"yellow"}]
execute if score .rollP ir matches 1 if score .flok ir matches 0 run scoreboard players set .flwarn ir 1
execute if score .rollP ir matches 1 if score .flok ir matches 1 run scoreboard players set .flwarn ir 0
execute if score .rollP ir matches 3 run data merge storage infinite_rail:args {dz:-15}
execute if score .rollP ir matches 3 run function infinite_rail:roll_add_row
execute if score .rollP ir matches 5 run data merge storage infinite_rail:args {dz:15}
execute if score .rollP ir matches 5 run function infinite_rail:roll_add_row
execute if score .rollP ir matches 7 run function infinite_rail:roll_stub
# Keep world spawn and respawn points moving with the ride so nothing is
# anchored to the origin.
execute if score .rollP ir matches 9 run setworldspawn ~ ~1 ~
execute if score .rollP ir matches 9 run spawnpoint @a ~ ~1 ~
scoreboard players add .rollP ir 1
execute if score .rollP ir matches 10.. run scoreboard players set .rollP ir 0
