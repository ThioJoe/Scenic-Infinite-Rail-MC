# Runs on datapack (re)load. Sets up the scoreboard and tunable constants.
scoreboard objectives add ir dummy

# --- Tunable constants ---
# Baseline height of the rail above the sampled average terrain surface.
scoreboard players set #HOVER ir 4
# Number of heightmap samples in the lookahead window (fixed by sample_window.mcfunction).
scoreboard players set #C12 ir 12
# Per-column limits on how far a single sample may pull the rolling average
# up/down. Small DOWNCLAMP = ravines and holes get bridged level instead of
# dipped into; larger UPCLAMP = mountains still raise the target early.
scoreboard players set #UPCLAMP ir 8
scoreboard players set #DOWNCLAMP ir 2

# --- Slope shaping (the "event" model) ---
# A climb/descent runs as one continuous 45-degree line until it reaches the
# target, so the rail is never stair-stepped. These constants control how big
# and how frequent those changes are.
# Minimum height difference (blocks) before a new climb/descent is triggered.
# Also acts as hysteresis so 1-block terrain noise never moves the rail.
scoreboard players set #DEADBAND ir 2
# Minimum flat blocks between two elevation changes in the SAME direction.
# Larger = fewer, longer swoops (terrain rising faster than this gets tunneled).
scoreboard players set #SAMEGAP ir 6
# Minimum flat blocks required before the rail may reverse direction.
# Larger = no quick up-then-down bobbing (bumps get tunneled, dips get bridged).
scoreboard players set #TURNGAP ir 10

# How far ahead of the minecart the track is kept built, in blocks.
scoreboard players set #AHEAD ir 112
# Maximum track columns built per game tick (catch-up budget).
scoreboard players set #MAXTICK ir 8

tellraw @a [{"text":"[Infinite Rail] ","color":"gold"},{"text":"Loaded. Run ","color":"gray"},{"text":"/function infinite_rail:start","color":"aqua"},{"text":" to begin the ride.","color":"gray"}]
