# The stretch-shift scan (CONTEXT.md section 7l): the "logical second pass"
# that lets a gap-blocked DESCENT jump the spacing gap entirely. When the
# line is waiting flat, wanting to descend, this scan checks -- before
# anything is built -- whether the whole planned move already verifies:
#   1. the entire shifted 45-degree descent path stays clear of ground
#      (by .DOWNGRACE), so the floor guard cannot cut it into pieces --
#      the shifted descent is the SAME single event to the SAME landing;
#   2. the landing really is a STRETCH: ground sits at the landing level
#      (within .MIN_CHANGE below the hover line) for .GAPSTRETCH columns --
#      so the calm the gap exists to guarantee simply happens at the
#      bottom instead of up on a clifftop bridge. Ground still falling
#      away fails this (a gentle downhill face is NOT a landing stretch,
#      and must keep its gap-paced swoops).
# Probes every 2 blocks (odd offsets, paired mins -- near_scan's spike
# eraser) out to the descent depth + .GAPSTRETCH, capped at 96 (must stay
# inside the generated corridor: .TERRAIN_GENAHEAD, default 192, covers it).
# Output: .sver = the verified horizon in blocks, written EVERY column
# (0 = not verified / not applicable / feature off). consider_start jumps
# the gap when .sver covers descent + stretch. Must run positioned at the
# head marker, like near_scan.
scoreboard players set .sver ir 0
# Gates: feature on; running flat; a descent of at least .MIN_CHANGE wanted.
execute if score .GAPSTRETCH cfg_ride matches ..0 run return 0
execute unless score .slope ir matches 0 run return 0
scoreboard players operation .sD ir = .railY ir
scoreboard players operation .sD ir -= .target ir
execute if score .sD ir < .MIN_CHANGE cfg_terrain run return 0
# Skip the probes when the gap cannot be what is blocking (the flat run
# already exceeds both gaps -- the descent starts normally anyway).
scoreboard players operation .smax ir = .SAMEGAP cfg_terrain
scoreboard players operation .smax ir > .TURNGAP cfg_terrain
execute if score .flat ir >= .smax ir run return 0
# Horizon: the whole descent plus the required landing stretch. Beyond the
# 96 cap the shift can never verify, so don't burn the probes.
scoreboard players operation .sH ir = .sD ir
scoreboard players operation .sH ir += .GAPSTRETCH cfg_ride
execute if score .sH ir matches 97.. run return 0
# The landing stretch's floor: ground below this would drag the average
# further down within the stretch (another descent due at once -- not calm).
scoreboard players operation .sband ir = .railY ir
scoreboard players operation .sband ir -= .sD ir
scoreboard players operation .sband ir -= .HOVER cfg_terrain
scoreboard players operation .sband ir -= .MIN_CHANGE cfg_terrain
# Walk to .sH + 1 so the last pair's far end reaches past the horizon.
scoreboard players add .sH ir 1
scoreboard players set .sp ir -32000
scoreboard players set .sk ir 1
execute positioned ~1 ~ ~ run function infinite_rail:shift_step
