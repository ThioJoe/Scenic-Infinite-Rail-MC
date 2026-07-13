# The lazy fill's macro half (positions and NBT list indices only take
# literals): probe the surface at offset o east of the head into .s, and
# write it into cache slot c[i] -- UNLESS the read is void/ungenerated
# (<= -63), which stays uncached (-32768) so a later column retries it once
# the corridor has generated that terrain. The probe itself is the same
# heightmap + not-terrain dig-down every sample has always used.
$execute positioned ~$(o) ~ ~ run function infinite_rail:probe_surface
execute store result score .s ir run data get entity @e[type=marker,tag=ir_probe,limit=1] Pos[1]
$execute if score .s ir matches -62.. store result storage infinite_rail:surf c[$(i)] int 1 run scoreboard players get .s ir
