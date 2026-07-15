# Auto-start's arrival, run `as` the starting player at the END of the
# countdown (tick.mcfunction, .start_timer 100+ with auto_ready satisfied),
# immediately BEFORE start fires in the same tick: put the player at the
# western start line (see auto_prep). The Y is nominal -- begin runs in the
# same command chain, anchors at this X/Z (block -99000, the Z 14
# centerline residue: snap offset zero, the rail forms exactly here), and
# its launch lift teleports the player onto the rail line before the tick
# ends -- so the only frame the client ever renders is the player standing
# on the start of the track. 320 (above the build limit) just guarantees
# the nominal position can't be inside terrain if something ever delays
# that same-tick handoff.
tp @s -98999.5 320 14.5
