# Auto-start's terrain-readiness probe, run every tick the countdown sits
# at 100+ (tick.mcfunction): begin is SYNCHRONOUS -- its surface probe must
# land on generated terrain the same tick -- so the start (and the player's
# arrival, auto_place) is held until the landing pad auto_prep queued at
# the countdown's first tick has actually generated. Checked at the anchor
# chunk and one probe a couple of chunks east (the launch runway's first
# stretch). Quarantined in its own file like time_now/check_clock/
# auto_gate: `execute if/unless loaded` is a newer subcommand (1.20.5+),
# and a command that fails to compile kills its whole file -- kept alone, a
# hypothetical failure only costs this probe, and the FAIL-OPEN wiring in
# tick (.relok preset to 1; this file only ever LOWERS it) degrades to
# firing at 100 ticks. Coordinates in step with auto_prep/auto_place.
execute unless loaded -99000 0 14 run scoreboard players set .relok ir 0
execute unless loaded -98968 0 14 run scoreboard players set .relok ir 0
