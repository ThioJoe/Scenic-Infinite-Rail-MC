# Rolling chunk management, run every 16 blocks of head travel, positioned
# at the head marker.
#
# SPLIT DESIGN (the burst fix): this trigger tick keeps the work that must
# not wait -- the passed-entity cull and the forceload release (their
# 16-block band tiling must never skip; a skipped band is chunks stranded
# force-loaded until stop) plus the track band's CENTER-row add (the one
# row the builder cannot advance without: its fresh-generation order has
# to go out the instant the roll fires, because on a generation-starved
# machine the frontier lead is exactly what keeps the pace cart on the
# track -- an earlier revision phased ALL the adds and the watchdog suite's
# 32 b/s sprint stress derailed the cart on slow 2-core CI runners). The
# phase machine (.rollP -> roll_phase, driven from main/launch_tick) then
# spreads the rest one slice per tick: north row, south row, torch stub,
# spawn-point moves. Queueing all three rows of fresh generation in one
# tick was the measured burst (~49ms p99 worst tick with 100s-of-ms
# whoppers on a 4-core test box, multi-second on one core); with only the
# center row on the trigger tick the worst tick stays a fraction of that
# while the neighbor rows lag at most ~2 ticks.
#
# Passed-entity cull -- the release band below (forceload remove,
# ~-336..-256 x ±64) is about to unload: remove passed mobs, drops and
# stands so they are neither saved into the unloaded chunks nor left for a
# revisit to reload (the safe salvage of the retired trail wiper -- entities
# only, no block work). The band is fully behind the ride by construction:
# the pace cart (the ride's rearmost piece, plug aboard) rides at ~-224, the
# rider at -.RIDER_BEHIND, and the head markers sit at the head itself.
# CRUCIAL EXCLUSION: the track's own smooth-stone disguise displays
# (block_display, tag ir_disp) live ONE PER COLUMN all the way back -- they
# are part of the built track, meant to stay with it (the track is left in
# the world; §6.3 stop). A bare type=!player killed them here, so ~256+
# blocks behind the head every support reverted to a bare RED redstone block
# -- invisible on a forward-only ride, but glaring when you REVERSE back
# through it (the "displays turn to redstone in groups" report). So the cull
# excludes the ride's own entity kinds (block_display / item_display / marker
# / minecart), exactly like main's pace-clear keeper -- it still sweeps mobs,
# drops, XP and armor stands (none of those types), and the displays ride
# out into the unloaded chunk with their track and reload intact on a
# revisit. (Displays in released chunks don't tick or count against the
# loaded-entity budget, so sparing them costs nothing.)
# (Mobs killed here spawn NO loot: setup_world turns mob death drops off --
# doMobLoot / 26.x mob_drops -- because loot would spawn AFTER this kill's
# selector evaluated and be saved into the very chunks the release below
# unloads. No XP either: command kills give no player credit. Bedrock's
# cull has no such gap -- its entity.remove() despawns without drops, and it
# never touches the track since Bedrock's rails carry no display disguise.)
execute positioned ~-336 -64 ~-64 run kill @e[type=!player,type=!block_display,type=!item_display,type=!marker,type=!minecart,dx=80,dy=384,dz=128]
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
# The center-row add + the .flok health signal. .flok is preset 0 HERE and
# store-successed inside roll_add_center, so a roll_add_center/roll_row
# file that fails to load on some game version leaves the 0 behind and
# still trips the one-shot warning below (re-armed after the next success)
# -- the same two-file protection the old roll_chunks/forceload_here split
# had.
scoreboard players set .flok ir 0
function infinite_rail:roll_add_center
execute if score .flok ir matches 0 unless score .flwarn ir matches 1 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Warning: chunk force-loading is failing, so terrain cannot be prepared ahead of the ride (track building will pause at the loaded edge). Please report this with your exact Minecraft version.","color":"yellow"}]
execute if score .flok ir matches 0 run scoreboard players set .flwarn ir 1
execute if score .flok ir matches 1 run scoreboard players set .flwarn ir 0
# Arm the phased tail -- only when idle: a trigger landing mid-cycle is
# deliberately ignored (the adds are stateless coverage from wherever the
# head is when their phase runs, so the NEXT trigger's cycle covers both;
# restarting mid-cycle would starve the later phases -- stub, spawn --
# during sustained catch-up bursts).
execute unless score .rollP ir matches 1.. run scoreboard players set .rollP ir 1
scoreboard players add .nextLoad ir 16
