# Keeps the track history bounded, like Bedrock's in-memory trim (HIST_MAX
# in main.js): the camera only ever reads a few hundred columns around the
# rig (`.RIDER_BEHIND` + the blend window behind the head), but the history
# used to grow ~4 bytes per column for the LIFE of a ride -- megabytes over
# a multi-day ride, all serialized into command_storage.dat on every world
# save (a slowly growing, recurring save-time cost for zero benefit).
# Called by advance right after it appends the new column: while an entry
# past index 2048 exists, drop the oldest column off the front and advance
# `.trackBase` with it (index = X - .trackBase, so every consumer -- the
# camera, the tests -- keeps reading the same X at the same place).
# Two drops per call vs one append per column = a legacy over-long history
# (a save from before this trim) drains gradually instead of hitching once;
# steady state is one drop per column and the length holds at ~2048. The
# `if data` probes are literal-index existence checks -- no list scan, no
# macro. 2048 comfortably exceeds every distance knob's sane range (the rig
# reads ~.RIDER_BEHIND + .CAMBLEND/2 + a few columns behind the head; keep
# .RIDER_BEHIND well under 2048, as on Bedrock).
execute unless data storage infinite_rail:track y[2048] run return 0
data remove storage infinite_rail:track y[0]
scoreboard players add .trackBase ir 1
execute unless data storage infinite_rail:track y[2048] run return 0
data remove storage infinite_rail:track y[0]
scoreboard players add .trackBase ir 1
