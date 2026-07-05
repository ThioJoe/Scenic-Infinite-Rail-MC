# Advances the track head one column east, choosing the rail elevation from
# a lookahead heightmap scan, then places that column.

# --- 1. Sample the terrain surface over the next 48 blocks ---
scoreboard players set #sum ir 0
execute at @e[type=marker,tag=ir_head,limit=1] run function infinite_rail:sample_window
scoreboard players operation #avg ir = #sum ir
scoreboard players operation #avg ir /= #C12 ir

# --- 2. Target elevation = average surface + hover altitude ---
scoreboard players operation #target ir = #avg ir
scoreboard players operation #target ir += #HOVER ir

# --- 3. Decide this column's slope: -1, 0, or +1 (event model) ---
function infinite_rail:decide

# --- 3b. If a slope just started, retro-clear the center bore behind it ---
# The shared start_event raises #retro when this column begins a climb or
# descent; the columns just BEFORE it were carved vegetation-sparing, but the
# camera lifts off the rail line early, so their full center bore is cleared
# after the fact (vertical only -- the sides keep their plants). The head has
# not moved yet, so it still marks the last built column.
execute if score #retro ir matches 1 at @e[type=marker,tag=ir_head,limit=1] run function infinite_rail:retro_clear
scoreboard players set #retro ir 0

# --- 4. Move the head to the new column and build it ---
# Flat: same elevation, straight rail (bridges over gaps / tunnels through rises).
execute if score #dir ir matches 0 as @e[type=marker,tag=ir_head,limit=1] at @s run tp @s ~1 ~ ~
execute if score #dir ir matches 0 at @e[type=marker,tag=ir_head,limit=1] run function infinite_rail:place_flat
# Descend: rail sits one lower, sloping down to the east.
execute if score #dir ir matches -1 as @e[type=marker,tag=ir_head,limit=1] at @s run tp @s ~1 ~-1 ~
execute if score #dir ir matches -1 at @e[type=marker,tag=ir_head,limit=1] run function infinite_rail:place_down
execute if score #dir ir matches -1 run scoreboard players remove #railY ir 1
# Climb: ascending rail at the current level, then the head steps up for the next column.
execute if score #dir ir matches 1 as @e[type=marker,tag=ir_head,limit=1] at @s run tp @s ~1 ~ ~
execute if score #dir ir matches 1 at @e[type=marker,tag=ir_head,limit=1] run function infinite_rail:place_up
execute if score #dir ir matches 1 as @e[type=marker,tag=ir_head,limit=1] at @s run tp @s ~ ~1 ~
execute if score #dir ir matches 1 run scoreboard players add #railY ir 1

scoreboard players add #headX ir 1

# --- 5. Record this column's rail height in the track history ---
# One int per column (index = X - #trackBase); the camera reads this list to
# fly a pre-smoothed path along the known profile (see cam_follow).
data modify storage infinite_rail:track y append value 0
execute store result storage infinite_rail:track y[-1] int 1 run scoreboard players get #railY ir

# --- 6. Rolling chunk management every 16 blocks ---
execute if score #headX ir >= #nextLoad ir at @e[type=marker,tag=ir_head,limit=1] run function infinite_rail:roll_chunks
