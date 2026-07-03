# Runs on datapack (re)load. Sets up the scoreboard and tunable constants.
scoreboard objectives add ir dummy

# --- Tunable constants ---
# Baseline height of the rail above the sampled average terrain surface.
scoreboard players set #HOVER ir 4
# Minimum horizontal blocks between 1-block elevation changes (max slope = 1/SPACING).
scoreboard players set #SPACING ir 3
# Number of heightmap samples in the lookahead window (fixed by sample_window.mcfunction).
scoreboard players set #C12 ir 12
# Per-column limits on how far a single sample may pull the rolling average
# up/down. Small DOWNCLAMP = ravines and holes get bridged level instead of
# dipped into; larger UPCLAMP = mountains still raise the target early.
scoreboard players set #UPCLAMP ir 8
scoreboard players set #DOWNCLAMP ir 2
# How far ahead of the minecart the track is kept built, in blocks.
scoreboard players set #AHEAD ir 112
# Maximum track columns built per game tick (catch-up budget).
scoreboard players set #MAXTICK ir 8

tellraw @a [{"text":"[Infinite Rail] ","color":"gold"},{"text":"Loaded. Run ","color":"gray"},{"text":"/function infinite_rail:start","color":"aqua"},{"text":" to begin the ride.","color":"gray"}]
