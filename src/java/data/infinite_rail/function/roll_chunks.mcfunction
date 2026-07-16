# Rolling chunk management, run every 16 blocks of head travel, positioned
# at the head marker.
#
# SPLIT DESIGN (the burst fix): this trigger tick keeps only the work that
# must stay synchronous -- the passed-entity cull and the forceload
# release, whose 16-block band tiling must never skip (a skipped band is
# chunks stranded force-loaded until stop) -- and ARMS the phase machine
# (.rollP) that spreads everything else one slice per phase over the
# following ticks (roll_phase, driven from main/launch_tick): the
# track-band add one chunk row at a time, then the torch stub, then the
# spawn-point moves. Queueing all three rows of fresh generation in one
# tick was the measured burst: ~49ms worst-tick (p99) with 100s-of-ms
# whoppers on a 4-core test box, multi-second worst ticks on one core;
# split per row the 4-core worst tick fell to ~68ms max (p99 ~37ms). The
# cull+release kept here measured a harmless ~20ms worst tick.
#
# Passed-entity cull -- the release band below (forceload remove,
# ~-336..-256 x ±64) is about to unload: remove every non-player entity in
# it first, so passed mobs, drops and stands are neither saved into the
# unloaded chunks nor left for a revisit to reload (the safe salvage of the
# retired trail wiper -- entities only, no block work). The band is fully
# behind the ride by construction: the pace cart (the ride's rearmost
# piece, plug aboard) rides at ~-224, the rider at -.RIDER_BEHIND, and the
# head markers sit at the head itself -- so type=!player is the only
# exclusion needed.
execute positioned ~-336 -64 ~-64 run kill @e[type=!player,dx=80,dy=384,dz=128]
# Second pass, items only: mobs killed by the line above drop their loot
# (doMobLoot is on; only doTileDrops is off), and those item entities spawn
# AFTER the first kill's selector was evaluated -- without this pass they
# were saved into the very chunks the release below unloads, the exact
# thing the cull exists to prevent. (No XP pass needed: command kills give
# no player credit, so no orbs spawn. Bedrock's cull has no such gap -- its
# entity.remove() despawns without drops.)
execute positioned ~-336 -64 ~-64 run kill @e[type=item,dx=80,dy=384,dz=128]
# Release the band behind, synchronous with the trigger on purpose: bands
# tile at exactly 16 blocks per roll, and a release deferred into a phase
# could be skipped during catch-up bursts (triggers can arrive faster than
# a phase cycle completes), leaving chunks force-loaded forever. As the
# head advances 16 at a time these bands tile to clear everything ≳256
# blocks back; the ±64 half-width is fixed and generous on purpose -- it
# covers every width the adds can have used (releasing a never-forced
# chunk is a no-op), so lowering .TORCHRANGE mid-ride or a dawn narrowing
# can't strand wide chunks loaded behind the ride.
forceload remove ~-336 ~-64 ~-256 ~64
# Arm the phased half -- only when idle: a trigger landing mid-cycle is
# deliberately ignored (the adds are stateless coverage from wherever the
# head is when their phase runs, so the NEXT trigger's cycle covers both;
# restarting mid-cycle would starve the later phases -- south row, stub,
# spawn -- during sustained catch-up bursts, degrading the 3-row frontier
# exactly when generation is racing).
execute unless score .rollP ir matches 1.. run scoreboard players set .rollP ir 1
scoreboard players add .nextLoad ir 16
