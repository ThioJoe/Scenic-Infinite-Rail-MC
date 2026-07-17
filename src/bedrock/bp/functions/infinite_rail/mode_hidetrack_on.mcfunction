# Mode toggle:  /function infinite_rail/mode_hidetrack_on
# Invisible track: columns built from the head onward get NO visible rail or
# support -- the ride appears to glide on thin air. Everything else about a
# column is unchanged (carve, track light, torches, surface restoration, the
# recorded history), so the movement is EXACTLY what it would be over real
# track. Already-built track keeps its rails. On Bedrock this is the whole
# feature: nothing rides the physical track (the pace is virtual, the ride
# cart is velocity-driven scenery), so scripts/main.js placeColumn simply
# skips the two placements while the score is 1 -- no strip needed (Java
# keeps a just-in-time rail strip under its REAL pace cart instead).
scoreboard players set .HIDETRACK ir 1
tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Invisible track ON - new track will not be shown (the ride keeps moving exactly the same)."}]}
