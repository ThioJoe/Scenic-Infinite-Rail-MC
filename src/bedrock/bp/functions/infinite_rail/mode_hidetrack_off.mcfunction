# Mode toggle:  /function infinite_rail/mode_hidetrack_off
# End invisible track: columns built from the head onward get their visible
# rail + support again (the invisible stretch already built stays as it is).
scoreboard players set .HIDETRACK ir 0
tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Invisible track OFF - new track is visible again."}]}
