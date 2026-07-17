# Mode toggle:  /function infinite_rail:mode_hidetrack_on
# Invisible track: every column built from the head onward is laid WITHOUT
# its visible rail + support (and support disguise) -- the ride appears to
# glide on thin air. Everything else about a column is unchanged (the carve,
# the track light, torches, the surface restoration, the recorded history),
# so the movement is EXACTLY what it would be over real track. Track built
# BEFORE the toggle keeps its rails -- nothing already placed is hidden.
# The hidden pace cart still physically needs powered rails, so a short
# just-in-time strip of track rolls along beneath it (placed a few columns
# ahead of it, removed behind it -- invis_tick & co.), (.PACE_CART_BEHIND -
# .RIDER_BEHIND) blocks behind the viewer where the cart itself already is.
# State like every mode: .HIDETRACK persists across /reload and rejoins, and
# which columns were built invisible is remembered per column (the track v
# list beside the y history), so toggling mid-ride never strands strip rails.
scoreboard players set .HIDETRACK ir 1
tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Invisible track ON - new track will not be shown (the ride keeps moving exactly the same).","color":"gray"}]
