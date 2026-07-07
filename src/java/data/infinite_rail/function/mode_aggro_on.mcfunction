# Mode toggle:  /function infinite_rail:mode_aggro_on
# MOBS AGGRO (the default): hostile mobs can see the rider and react like
# they would to any player -- creepers sneak up and hiss, skeletons draw
# their bows, zombies groan and give chase. Pure ambience: the rider is
# untouchable regardless (Resistance 255 + the damage gamerules), and mobs
# can't reach or shift the rig (the rider is a pinned passenger). The
# lever is the invisibility effect on the rider -- mobs detect by sight --
# so this clears it. (On Bedrock the same effect is what hid the
# first-person arm, so aggro ON shows the arm there; Java's arm was always
# visible -- invisibility never hid it.) State like every mode;
# launch_done applies the current choice at ride start.
scoreboard players set .AGGROMODE ir 1
effect clear @a[tag=ir_rider] minecraft:invisibility
tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Mobs aggro ON - mobs will notice you and react.","color":"gray"}]
