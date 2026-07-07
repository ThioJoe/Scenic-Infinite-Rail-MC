# Mode toggle:  /function infinite_rail/mode_aggro_on
# MOBS AGGRO (the default): hostile mobs can see the rider and react --
# creepers sneak up and hiss, skeletons draw their bows, zombies groan and
# give chase. Pure ambience: the rider is untouchable regardless
# (Resistance 255 + the damage gamerules). The lever is the invisibility
# effect the script's keeper manages (scripts/main.js): on Bedrock,
# invisible players are COMPLETELY undetectable by mobs -- which is why
# rides used to glide through the night in total silence -- and the same
# effect is what hid the first-person arm (the retired .HIDEHAND knob), so
# aggro ON also shows the arm. The keeper applies the change within a
# second.
scoreboard players set .AGGROMODE ir 1
tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Mobs aggro ON - mobs will notice you and react (this also un-hides your first-person arm)."}]}
