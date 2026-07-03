# Rolling chunk management, run every 16 blocks of head travel, positioned
# at the head marker.

# Force-generate terrain well ahead of the head so the heightmap scanner
# always has real data (~192 blocks of lead = plenty of generation time).
forceload add ~ ~-8 ~191 ~8
# Aggressively release chunks far behind; there is no going back.
forceload remove ~-336 ~-8 ~-256 ~8
# Keep world spawn and respawn points moving with the ride so nothing is
# anchored to the origin.
setworldspawn ~ ~1 ~
spawnpoint @a ~ ~1 ~
scoreboard players add #nextLoad ir 16
