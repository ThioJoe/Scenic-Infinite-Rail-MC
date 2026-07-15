# Auto-start's landing-pad prep, run the tick the countdown begins
# (tick.mcfunction, .start_timer 1): force-load and generate the chunks
# around the WESTERN START LINE -- X = -99000, Z 14 (the centerline
# residue, so the anchor snap lands the rail exactly under the arriving
# player) -- while the 5-second countdown runs. The player is NOT touched
# here: they are teleported only at the END of the countdown (auto_place),
# once auto_ready confirms the pad exists, and begin seats them on the
# rail line in the same tick -- no sky drop, no fall, no loading screen
# hover. The countdown doing chunk-loading work is exactly what it was
# for; this just points it at the destination instead of the spawn.
#
# WHY -99000: heading east forever, starting deep west roughly doubles the
# time the ride spends at low absolute coordinates, where Bedrock's 32-bit
# floating-point positions are at their most precise (|X| <= 99k is ~6.9
# hours at the default 8 blocks/s vs ~3.4 from a spawn near zero); Java
# mirrors it for cross-edition parity (its own ±2.1M camera fixed-point
# limit only gains margin). Fresh worlds only by construction: the
# countdown never runs once .autodone is set, so manual starts and every
# restart anchor where the rider stands.
#
# The pad: X -99032..-98936 (a chunk behind the anchor plus ~6 ahead, so
# the launch runway starts on real terrain), Z -18..46 (±32 around the
# line). begin re-forceloads from the anchor the moment it runs (its reset
# clears all forceloads first; chunks unload lazily, so nothing blinks).
# Keep the coordinates in step with auto_ready, auto_place, and START_X /
# START_Z in the Bedrock script (main.js) -- literals, because forceload
# and tp cannot read scoreboards.
forceload add -99032 -18 -98936 46
