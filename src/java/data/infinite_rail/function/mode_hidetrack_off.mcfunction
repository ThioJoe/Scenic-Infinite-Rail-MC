# Mode toggle:  /function infinite_rail:mode_hidetrack_off
# End invisible track: columns built from the head onward get their visible
# rail + support again. The invisible stretch already built stays invisible
# (its columns are marked in the track v list, and the pace cart's
# just-in-time strip keeps serving them whenever the cart crosses that
# stretch -- including backwards at negative ride speeds).
scoreboard players set .HIDETRACK ir 0
tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Invisible track OFF - new track is visible again.","color":"gray"}]
