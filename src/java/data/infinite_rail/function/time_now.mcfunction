# The ONE place Java answers "is it night right now?" (-> .tod), quarantined
# in its own file ON PURPOSE (see the post-mortems in forceload_here and
# build_loop -- /time-adjacent code must never be able to take another file
# down with it).
#
# HOW: the #infinite_rail:night PREDICATE (predicate/night.json), vanilla's
# own data-driven day/night test (`minecraft:time_check`, period 24000,
# window 12542..23459). A predicate is evaluated FRESH on every
# `execute if predicate` against the same day-time value that renders the
# sky, so it is correct no matter how the current time came about --
# natural rollover, `/time set`, a frozen cycle, the works.
#
# WHY NOT `time query daytime`: that was the original fetch, and it broke
# on Java 26.2 -- the 26.1 World Clock rework changed what /time's stored
# query results report (a clock's total elapsed ticks rather than the
# day time), and the reading no longer tracks `/time set`, so torch mode's
# auto gate stayed dark even in a forced night. The predicate keys off the
# actual day time; no arithmetic, no version-dependent query spelling, one
# file for the whole 1.21..26.x range.
#
# The answer is handed onward as a REPRESENTATIVE day time so the shared
# torch_auto (which Bedrock feeds a real 0..23999 clock reading) stays
# byte-identical across editions: 18000 (midnight, mid-window) when the
# predicate matches, 6000 (noon, outside) when it does not. Keep the
# predicate's window in sync with torch_auto's 12542..23459.
# A broken/unloaded predicate file evaluates as false = never night --
# torch auto degrades to unlit and nothing worse; load self-tests the
# night/day predicate pair and warns loudly if both read false.
scoreboard players set .tod ir 6000
execute if predicate infinite_rail:night run scoreboard players set .tod ir 18000
