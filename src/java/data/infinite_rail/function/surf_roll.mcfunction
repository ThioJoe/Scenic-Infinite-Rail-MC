# The rolling surface cache (storage infinite_rail:surf c): one RAW terrain
# height per block ahead of the head -- c[i] = probe_surface's answer at
# X = .surfBase + i (the Y one above the surface), or -32768 = "never
# probed". The head advances one column east per column, so the three
# probe-hungry walks (sample_window, near_scan, shift_scan) used to re-probe
# the SAME terrain ~100 times each as their windows slid past it -- the
# single biggest per-column cost, and the whole reason catch-up bursts
# (.BUILD_PER_TICK columns in one tick) hurt. Now each X ahead of the ride
# is probed ONCE, on first read (the surf_prep/surf_fill lazy fill), and
# every walk reads the cached value. Terrain ahead of the ride never
# changes (the pack only ever modifies blocks at/behind the head, and the
# not-terrain dig-down ignores everything that grows or falls), so a cached
# read IS the fresh read; a void/ungenerated probe stays UNCACHED (-32768),
# so it is retried until the corridor has generated the terrain, exactly
# like the old per-column re-probing. Bedrock has always worked this way
# (main.js's surfMemo) -- this brings Java's native sampling to parity.
#
# This file is the per-column maintenance, called by sample_window (after
# it derives .wstep/.winn) before any walk reads: slide the window when the
# head has advanced one column, rebuild it empty on any desync (ride
# restart, .SAMPLE_WINDOW changed live, pack updated over an old save).
# Score math + at most two list edits; no probes here.

# The reach: everything any walk can read -- the sample window (its last
# sample sits at .winn x .wstep, past .SAMPLE_WINDOW when the interval
# doesn't divide it... floored by the derivation, so <= .SAMPLE_WINDOW; the
# near scan reads odd offsets to .SAMPLE_WINDOW), floored at 98 so the
# stretch-shift scan's fixed 96-block cap (+1: its walk reads one past the
# horizon) is always covered.
scoreboard players operation .suL ir = .SAMPLE_WINDOW cfg_terrain
scoreboard players operation .suR ir = .winn ir
scoreboard players operation .suR ir *= .wstep ir
execute if score .suR ir > .suL ir run scoreboard players operation .suL ir = .suR ir
execute unless score .suL ir matches 98.. run scoreboard players set .suL ir 98

# Desired base: the column after the head (walk offset 1 = c[0]).
scoreboard players operation .suB ir = .headX ir
scoreboard players add .suB ir 1

# A base that has never been set (fresh ride, pre-cache world save) can't be
# compared against -- rebuild. (matches -2147483648.. is "any set value".)
execute unless score .surfBase ir matches -2147483648.. run return run function infinite_rail:surf_reset

# Actual size (data get on a list returns its element count; a missing list
# fails and stores 0) vs the wanted reach, and the base drift.
execute store result score .suN ir run data get storage infinite_rail:surf c
scoreboard players operation .suD ir = .suB ir
scoreboard players operation .suD ir -= .surfBase ir

# Aligned and right-sized: nothing to do (the steady state between columns
# of one tick's build burst is ONE list pop + ONE append, in surf_slide).
execute if score .suD ir matches 0 if score .suN ir = .suL ir run return 0
# The normal slide: the head advanced exactly one column since last time.
execute if score .suD ir matches 1 if score .suN ir = .suL ir run return run function infinite_rail:surf_slide
# Anything else -- ride restart, live .SAMPLE_WINDOW tweak, missing list --
# rebuild empty; the first column's walks re-probe lazily (old behavior).
function infinite_rail:surf_reset
