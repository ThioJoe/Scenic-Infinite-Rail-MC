# Running flat: begin a climb/descent only if BOTH hold:
#   1. the target is at least .DEADBAND blocks away (ignore small terrain noise), and
#   2. enough flat distance has passed since the last event --
#        .SAMEGAP columns to slope again in the SAME direction, or
#        .TURNGAP columns to reverse direction
#      (a large previous event shortens either gap -- the big-event gap
#       credit below).
# If a change is wanted but a gap forbids it, we hold the current height. That
# is deliberate: terrain rising into us then becomes a tunnel ("punch through
# instead of going over it") and terrain dropping away becomes a bridge
# ("build a bridge instead of going down").

scoreboard players set .want ir 0
execute if score .diff ir >= .DEADBAND cfg_terrain run scoreboard players set .want ir 1
scoreboard players set .ndead ir 0
scoreboard players operation .ndead ir -= .DEADBAND cfg_terrain
execute if score .diff ir <= .ndead ir run scoreboard players set .want ir -1

# --- Ground-contact overrides (the near scan; see decide's guard block) ---
# Climb ON SCHEDULE: even when the average already wants a climb, hold it
# until the 45-degree cone says it is due (.due, from decide -- the rail is
# within .UPEARLY blocks of the height needed to crest what is coming).
# This is what keeps the ramp from starting dozens of blocks before the
# mountain; the flat gap keeps counting while held, so the wait can never
# cause a gap-block later.
execute if score .want ir matches 1 if score .due ir matches 0 run scoreboard players set .want ir 0
# Climb EARLY (inside the deadband): the level line is about to plow into
# terrain within .UPLOOK (.gmax above the rail), the average confirms rising
# ground (.diff >= 1), and the schedule agrees (.due): want the climb now
# instead of tunneling in and climbing late. The spacing gaps below still
# have the final say.
execute unless score .SKYMODE ir matches 1 if score .UPLOOK cfg_terrain matches 1.. if score .want ir matches 0 if score .diff ir matches 1.. if score .gmax ir > .railY ir if score .due ir matches 1 run scoreboard players set .want ir 1
# Descend LATE: never START a descent without clear runway -- if there is
# not room for even two steps above the tallest ground within .DOWNLOOK
# (.dig2, from decide), hold the level and let the ground fall away first.
# The descent then begins at the drop-off and glides down in open air,
# rather than opening an event that would stop on its first step.
execute unless score .want ir matches 0.. if score .dig2 ir matches 1 run scoreboard players set .want ir 0

# No change wanted: stay flat and keep counting toward the next gap.
execute if score .want ir matches 0 run scoreboard players add .flat ir 1

# Change wanted: required gap is .SAMEGAP to repeat the last direction, else .TURNGAP.
execute unless score .want ir matches 0 if score .want ir = .lastDir ir run scoreboard players operation .need ir = .SAMEGAP cfg_terrain
execute unless score .want ir matches 0 unless score .want ir = .lastDir ir run scoreboard players operation .need ir = .TURNGAP cfg_terrain

# --- The big-event gap credit (the "gap adjuster") ---
# The gaps exist to stop small bobbing, but after a LARGE climb/descent the
# full gap itself reads as a mistake: a long flat bridge overshooting a peak
# before the line may come back down (.TURNGAP), or long tunneled benches
# between the chained climb events of one big ascent (.SAMEGAP). So the last
# event's size (.evrun -- its column count, which at 45 degrees is its
# height) buys the NEXT event a proportional discount: .need shrinks by
# .evrun / .GAPRATIO (the adjuster; 0 turns the credit off). Guard: the move
# being considered must itself be worth it -- at least .evrun / .GAPMATCH
# blocks (0 = no size requirement) -- so a big climb never lets a small bob
# through early, and an absurdly large credit (a sky-mode glide) demands an
# equally large follow-up or none at all. Small events earn next to nothing;
# the discounted gap is floored at 0; and a credit can never go stale in a
# harmful way -- once enough columns pass, .flat exceeds the FULL gap anyway
# and the discount changes nothing, so it only ever acts close behind the
# event that earned it. The dialect note in decide applies: no negative
# literals in matches ranges, so |.diff| is built by multiplying with .want
# (nonzero in the guarded lines, and .diff always carries .want's sign).
scoreboard players add .evrun ir 0
scoreboard players set .gapcut ir 0
execute if score .GAPRATIO cfg_terrain matches 1.. run scoreboard players operation .gapcut ir = .evrun ir
execute if score .GAPRATIO cfg_terrain matches 1.. run scoreboard players operation .gapcut ir /= .GAPRATIO cfg_terrain
scoreboard players operation .gmag ir = .diff ir
scoreboard players operation .gmag ir *= .want ir
# For CLIMBS the average is a poor size witness: it dilutes an approaching
# rise to roughly half while the window still spans the low ground in front
# (and the schedule forces climbs to start exactly there), so the size of
# what is coming is taken from the near scan instead where it reads larger:
# .gmax + .HOVER - .railY, the climbing actually needed to hover over the
# highest ground within .UPLOOK. (.gmax's no-data sentinel -10000 makes
# .gup hugely negative -- the max then keeps the average's answer.)
# Descents hold ON TOP of the drop while the average falls away below, so
# .diff already shows a descent's full size by the time one is wanted.
scoreboard players operation .gup ir = .gmax ir
scoreboard players operation .gup ir += .HOVER cfg_terrain
scoreboard players operation .gup ir -= .railY ir
execute if score .want ir matches 1 run scoreboard players operation .gmag ir > .gup ir
scoreboard players operation .gth ir = .evrun ir
execute if score .GAPMATCH cfg_terrain matches 1.. run scoreboard players operation .gth ir /= .GAPMATCH cfg_terrain
execute if score .GAPMATCH cfg_terrain matches 1.. if score .gmag ir < .gth ir run scoreboard players set .gapcut ir 0
execute unless score .want ir matches 0 run scoreboard players operation .need ir -= .gapcut ir
execute unless score .need ir matches 0.. run scoreboard players set .need ir 0

# Enough distance -> start the event; otherwise hold (tunnel/bridge) and keep
# counting. The .slope guard skips the increment when start_event just fired
# (it sets .slope nonzero and zeroes .flat).
execute unless score .want ir matches 0 if score .flat ir >= .need ir run function ir_start_event
execute unless score .want ir matches 0 if score .slope ir matches 0 run scoreboard players add .flat ir 1
