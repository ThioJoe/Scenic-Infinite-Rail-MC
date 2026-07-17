# The pace-cart stop watchdog: the 3-second check, run from main every 60
# ticks while the ride is active (.started 1). The per-tick stall keeper in
# main already re-boosts a cart that is merely resting ON the rails -- this
# watchdog catches what that boost cannot fix: a cart that DERAILED (ran off
# the end of the built track when terrain generation fell behind and buried
# itself against the tunnel face or down a pit -- a motion merge just shoves
# it into the wall forever), a cart whose entity vanished outright, or a
# cart wedged anywhere the rails aren't. Detection is deliberately dumb and
# safe: the cart's X must have advanced at least 1.5 blocks since the last
# check, i.e. an average of 0.5 blocks/s over 3 seconds. The slowest moving
# speed the pack can select is 1 block/s in either direction (the grid steps
# ... -1, 0, 1 ...; a 45° climb still nets ~0.7 blocks/s of X), so a healthy
# ride clears the bar with 2x margin at ANY selectable speed, in any mode
# (sky, ocean sprint, mid speed-flap) -- only a cart that is genuinely going
# nowhere for a full 3-6 s window trips it. Stop-and-reverse aware: the
# check runs against the SIGNED target .curtgt (main recomputes it every
# tick) -- westward progress is what counts while reversing, a sign flip
# re-baselines the window (main), and a PARKED ride (target 0) skips the
# watchdog entirely. Recovery is pace_fix: snap the cart back onto the
# built track a few rails ahead of where it stands (ahead = the direction
# of travel).
# (Java-only by design, like the stall keeper: Bedrock's pace is a virtual
# position advanced by script -- there is no physical cart to derail.)
scoreboard players set .wdt ir 0
# A save upgraded mid-ride has no watchdog scores yet: create them at 0 (the
# first check then reads as a huge move = healthy, and just seeds .wdX).
scoreboard players add .wdX ir 0
scoreboard players add .wdmiss ir 0
scoreboard players add .wdstuck ir 0
# ...and no recorded centerline either (begin records .lineZ per ride now):
# capture it from the cart's own Z once, while one is still there to read.
# The self-compare trick reads "is the score unset" -- an unset score fails
# every comparison, even with itself. (pace_fix refuses to recover while
# .lineZ is unknown, so a garbage Z can never be teleported to.) The
# if-entity guard sits BEFORE the store on purpose: a store whose inner
# command fails writes 0 on modern versions, and a store downstream of a
# passed condition still fires -- conditions ahead of the store are what
# keep a missing cart from minting a bogus .lineZ 0.
execute unless score .lineZ ir = .lineZ ir if entity @e[type=minecart,tag=ir_cart,limit=1] store result score .lineZ ir run data get entity @e[type=minecart,tag=ir_cart,limit=1] Pos[2] 1

# Parked (stop-and-reverse: the signed target .curtgt, recomputed by main
# every tick, is 0): nothing is supposed to move -- no movement check, no
# missing-cart resummon, no recovery. The baseline .wdX stays where the cart
# stopped, and a cart whose chunk is momentarily unloaded simply waits for
# it (or for the next nonzero speed) instead of being twinned.
execute if score .curtgt ir matches 0 run return 0

# Dedup guard: if a recovery re-summon ever races a cart whose chunk was
# merely unloaded (not dead), two pace carts would fight over every
# limit=1 selector. Kill the FURTHEST-behind extra (measured from the head)
# until one remains -- one per check is plenty, this can only ever happen
# after a recovery summon.
execute store result score .wdn ir if entity @e[type=minecart,tag=ir_cart]
execute if score .wdn ir matches 2.. at @e[type=marker,tag=ir_head,limit=1] run kill @e[type=minecart,tag=ir_cart,sort=furthest,limit=1]

# --- Missing cart (nuked, or its chunk fell out of ticking) ---------------
# Selectors cannot see unloaded entities, so "missing" and "unloaded" look
# identical. Wait a SECOND consecutive check (~6 s) before re-summoning, so
# a transient chunk hiccup can reload the original instead of spawning a
# twin (the dedup above mops up the rare race that still slips through:
# the stray reloads behind, and roll_chunks' passed-entity cull band would
# sweep it anyway). pace_fix's target is derived from the watchdog's own
# last-known-good baseline (.wdX -- NOT .cartX, which store-fails to 0
# every tick while the cart is gone), so the fresh cart resumes right
# where the old one vanished.
# The .wdgone flag is snapshotted ONCE: pace_fix's re-summon makes the cart
# exist again mid-branch, so re-testing `unless entity` after it would fall
# through into the movement check and double-fire a recovery on the fresh
# cart (whose window trivially reads "went nowhere").
scoreboard players set .wdgone ir 0
execute unless entity @e[type=minecart,tag=ir_cart,limit=1] run scoreboard players set .wdgone ir 1
execute if score .wdgone ir matches 1 run scoreboard players add .wdmiss ir 1
execute if score .wdgone ir matches 1 if score .wdmiss ir matches 4 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Warning: the hidden pace cart is gone and could not be replaced (its spot may be in unloaded chunks). The watchdog keeps retrying every 3 seconds. If this persists, please report it with your Minecraft version.","color":"yellow"}]
execute if score .wdgone ir matches 1 if score .wdmiss ir matches 2.. run function infinite_rail:pace_fix
execute if score .wdgone ir matches 1 run return 0
scoreboard players set .wdmiss ir 0

# --- The movement check ----------------------------------------------------
# X only: the ride travels due east, so eastward progress IS the health
# signal -- a cart that fell down a pit or drifted backward reads stuck too.
# Fixed point x10 so the 1.5-block threshold fits an int scoreboard (15).
execute store result score .wdn ir run data get entity @e[type=minecart,tag=ir_cart,limit=1] Pos[0] 10
scoreboard players operation .wdmv ir = .wdn ir
scoreboard players operation .wdmv ir -= .wdX ir
scoreboard players operation .wdX ir = .wdn ir

# --- The on-track check -----------------------------------------------------
# Movement alone is NOT enough: a cart that flew off the end of the built
# track onto open ground gets shoved east by the per-tick stall keeper's
# motion boost (~0.5 blocks per re-boost tick) -- X keeps advancing, so it
# never reads "stopped" while it bulldozes cross-country away from the
# line, even overrunning the paused build head. So every check also
# verifies the cart is ON the recorded line; any miss counts as stuck even
# at full speed. Three conditions, all plain score math:
scoreboard players set .wdoff ir 0
scoreboard players operation .wdxi ir = .wdn ir
scoreboard players operation .wdxi ir /= .C10 ir
# (a) At or past the build head = at/off the end of the built track. A
# healthy ride keeps the cart ~.PACE_CART_BEHIND behind the head; the only
# way to be here is a paused builder about to derail the cart (or one that
# already did). Catching it at the origin also pins the cart at the track
# end in 3-second hops for as long as the builder stays starved.
scoreboard players operation .wds ir = .headX ir
scoreboard players remove .wds ir 1
execute if score .wdxi ir > .wds ir run scoreboard players set .wdoff ir 1
# (b) Drifted off the centerline by 1.5+ blocks (rails hold a cart's Z at
# the block center dead-exact; .lineZ was ensured above).
execute store result score .wdzn ir run data get entity @e[type=minecart,tag=ir_cart,limit=1] Pos[2] 10
scoreboard players operation .wds ir = .lineZ ir
scoreboard players operation .wds ir *= .C10 ir
scoreboard players add .wds ir 5
scoreboard players operation .wdzn ir -= .wds ir
execute if score .wdzn ir matches 15.. run scoreboard players set .wdoff ir 1
execute if score .wdzn ir matches ..-15 run scoreboard players set .wdoff ir 1
# (c) Height disagrees with the track history at the cart's column: on the
# line the cart sits 0..~1.1 above the physical rail level min(y[i-1],y[i])
# (mid-slope interpolation included), so anything below -0.5 or above +1.5
# is a cart rolling under/over the line, not on it. Skipped when (a)
# already flagged (the index would be out of range) or when the history
# doesn't answer for this column (pack updated over a live ride -- the
# -30000 preset survives a failed cam_get read, matching cam_follow's own
# no-history bail-out; recovery would have no correct Y to offer anyway).
execute if score .wdoff ir matches 0 run scoreboard players operation .wdi ir = .wdxi ir
execute if score .wdoff ir matches 0 run scoreboard players operation .wdi ir -= .trackBase ir
execute if score .wdoff ir matches 0 if score .wdi ir matches ..0 run scoreboard players set .wdi ir 1
execute if score .wdoff ir matches 0 run scoreboard players set .ly ir -30000
execute if score .wdoff ir matches 0 store result storage infinite_rail:cami i int 1 run scoreboard players get .wdi ir
execute if score .wdoff ir matches 0 run function infinite_rail:cam_get with storage infinite_rail:cami
execute if score .wdoff ir matches 0 run scoreboard players operation .wdry ir = .ly ir
execute if score .wdoff ir matches 0 run scoreboard players remove .wdi ir 1
execute if score .wdoff ir matches 0 store result storage infinite_rail:cami i int 1 run scoreboard players get .wdi ir
execute if score .wdoff ir matches 0 unless score .wdry ir matches -30000 run function infinite_rail:cam_get with storage infinite_rail:cami
execute if score .wdoff ir matches 0 if score .ly ir < .wdry ir run scoreboard players operation .wdry ir = .ly ir
execute if score .wdoff ir matches 0 unless score .wdry ir matches -30000 run scoreboard players operation .wdry ir *= .C10 ir
execute if score .wdoff ir matches 0 unless score .wdry ir matches -30000 store result score .wdyn ir run data get entity @e[type=minecart,tag=ir_cart,limit=1] Pos[1] 10
execute if score .wdoff ir matches 0 unless score .wdry ir matches -30000 run scoreboard players operation .wdyn ir -= .wdry ir
execute if score .wdoff ir matches 0 unless score .wdry ir matches -30000 if score .wdyn ir matches 16.. run scoreboard players set .wdoff ir 1
execute if score .wdoff ir matches 0 unless score .wdry ir matches -30000 if score .wdyn ir matches ..-6 run scoreboard players set .wdoff ir 1

# Healthy: at least 1.5 blocks of progress IN THE RIDE'S DIRECTION since the
# last check (east while .curtgt is positive, west while negative -- the
# sign-flip itself re-baselines the window in main, so a mixed window can't
# read as a false stall) AND still on the line.
scoreboard players set .wdok ir 0
execute if score .curtgt ir matches 1.. if score .wdmv ir matches 15.. run scoreboard players set .wdok ir 1
execute if score .curtgt ir matches ..-1 if score .wdmv ir matches ..-15 run scoreboard players set .wdok ir 1
execute if score .wdok ir matches 1 if score .wdoff ir matches 0 run scoreboard players set .wdstuck ir 0
execute if score .wdok ir matches 1 if score .wdoff ir matches 0 run return 0

# --- Stuck: the cart went nowhere for a full 3-second window ---------------
scoreboard players add .wdstuck ir 1
execute if score .DEBUGMODE ir matches 1 run tellraw @a [{"text":"[SR Debug] ","color":"dark_aqua"},{"text":"pace cart stalled (moved ","color":"gray"},{"score":{"name":".wdmv","objective":"ir"},"color":"white"},{"text":"/10 blocks in 3s, streak ","color":"gray"},{"score":{"name":".wdstuck","objective":"ir"},"color":"white"},{"text":") - snapping it back onto the track","color":"gray"}]
# Persistent stall = something bigger is wrong (terrain generation can't
# keep up at all, or the track itself is obstructed). One-shot per episode:
# fires at exactly 3 consecutive stuck checks, resets with the streak.
execute if score .wdstuck ir matches 3 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Warning: the ride keeps stalling - the pace cart has needed rescuing 3 times in a row. The server is likely struggling to load or generate terrain fast enough; the watchdog will keep nudging the ride along. Lowering the ride speed can help.","color":"yellow"}]
function infinite_rail:pace_fix
