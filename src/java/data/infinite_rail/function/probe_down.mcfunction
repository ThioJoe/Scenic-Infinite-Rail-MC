# One step of probe_surface's dig-down (recursive): the caller verified the
# block under the probe is #infinite_rail:not_terrain, so move the probe
# down one block and keep digging until real terrain (or a liquid surface)
# is under it. Runs positioned at the probe; the recursion carries the
# position down with it. Terminates at the world floor at the latest (an
# if-block check below Y -64 simply fails), and a probe that ends up at or
# below Y -63 reads as a void sample and is discarded by the caller.
tp @e[type=marker,tag=ir_probe,limit=1] ~ ~-1 ~
execute positioned ~ ~-1 ~ if block ~ ~-1 ~ #infinite_rail:not_terrain run function infinite_rail:probe_down
