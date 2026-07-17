# Invisible-track strip: resolve ONE column (.stpC = its world X) into the
# strip macros' arguments. Answers .stok:
#   1 = this column was built INVISIBLE (track v reads <= 0) and its geometry
#       resolved -- storage infinite_rail:strip now holds {x, ry, sy, z,
#       shape, surf} (rail cell, support cell, centerline, rail shape, and
#       the surface block to repaint the support cell to on wipe).
#   0 = leave this column alone: it was built VISIBLE (v 1), predates the
#       v list (a save from before this feature -- never touch real track),
#       or the history has no answer.
# The v value encodes the center surface class (advance: 1 = visible, else
# the negated class 0/-1..-5 -- see carve's .sfcC), so the strip repaints the
# support cell to the SAME material carve restored at build.
# The physical geometry is derived exactly like pace_watch/pace_fix do it:
# the history records each column's EXIT height, a climbing column's blocks
# sit one below it, so the rail level is min(y[i-1], y[i]) (place_up's
# rule), and the shape falls out of the same comparison -- y rising into
# this column = ascending_east, falling = ascending_west, level = east_west.
scoreboard players set .stok ir 0

# The visibility flag: v[X - .stpBase]. Preset 1 (= real track, hands off):
# a missing list, an out-of-range index and a pre-feature save all read as
# visible. (v rides its own base -- a mid-ride pack upgrade starts the list
# at the first column built after the update, see advance.)
scoreboard players set .stv ir 1
execute unless score .stpBase ir = .stpBase ir run return 0
scoreboard players operation .sti ir = .stpC ir
scoreboard players operation .sti ir -= .stpBase ir
execute if score .sti ir matches ..-1 run return 0
execute store result storage infinite_rail:cami i int 1 run scoreboard players get .sti ir
function infinite_rail:strip_get_v with storage infinite_rail:cami
# Visible (v 1) -> hands off. Invisible is v <= 0; the class is its negation.
execute if score .stv ir matches 1 run return 0
scoreboard players set .stcls ir 0
scoreboard players operation .stcls ir -= .stv ir
# The surface block strip_wipe repaints the support cell to (matches carve's
# surf_class: 0 leave-as-air / 1 grass / 2 podzol / 3 mycelium / 4 moss /
# 5 snow -- a snow_block stands in for the layer+grass carve uses, close
# enough for a cell nobody stands on).
data modify storage infinite_rail:strip surf set value "minecraft:air"
execute if score .stcls ir matches 1 run data modify storage infinite_rail:strip surf set value "minecraft:grass_block"
execute if score .stcls ir matches 2 run data modify storage infinite_rail:strip surf set value "minecraft:podzol"
execute if score .stcls ir matches 3 run data modify storage infinite_rail:strip surf set value "minecraft:mycelium"
execute if score .stcls ir matches 4 run data modify storage infinite_rail:strip surf set value "minecraft:moss_block"
execute if score .stcls ir matches 5 run data modify storage infinite_rail:strip surf set value "minecraft:snow_block"

# The rail geometry: y[i] and y[i-1] from the track history.
scoreboard players operation .sti ir = .stpC ir
scoreboard players operation .sti ir -= .trackBase ir
execute if score .sti ir matches ..-1 run return 0
scoreboard players set .ly ir -30000
execute store result storage infinite_rail:cami i int 1 run scoreboard players get .sti ir
function infinite_rail:cam_get with storage infinite_rail:cami
execute if score .ly ir matches -30000 run return 0
scoreboard players operation .sty ir = .ly ir
scoreboard players operation .sty0 ir = .ly ir
scoreboard players remove .sti ir 1
scoreboard players set .ly ir -30000
execute if score .sti ir matches 0.. store result storage infinite_rail:cami i int 1 run scoreboard players get .sti ir
execute if score .sti ir matches 0.. run function infinite_rail:cam_get with storage infinite_rail:cami
execute if score .sti ir matches 0.. unless score .ly ir matches -30000 run scoreboard players operation .sty0 ir = .ly ir

# Physical rail level = min(y[i-1], y[i]); shape from the same comparison.
scoreboard players operation .stry ir = .sty ir
execute if score .sty0 ir < .stry ir run scoreboard players operation .stry ir = .sty0 ir
data modify storage infinite_rail:strip shape set value "east_west"
execute if score .sty ir > .sty0 ir run data modify storage infinite_rail:strip shape set value "ascending_east"
execute if score .sty ir < .sty0 ir run data modify storage infinite_rail:strip shape set value "ascending_west"

# Macro args: rail cell (x, ry, z) and the support cell below it (sy).
execute store result storage infinite_rail:strip x int 1 run scoreboard players get .stpC ir
execute store result storage infinite_rail:strip ry int 1 run scoreboard players get .stry ir
scoreboard players remove .stry ir 1
execute store result storage infinite_rail:strip sy int 1 run scoreboard players get .stry ir
execute store result storage infinite_rail:strip z int 1 run scoreboard players get .lineZ ir
scoreboard players set .stok ir 1
