# Per-tick driver while the ride is active.

# Track the pace cart's X position for the build-ahead gap calculation.
execute store result score .cartX ir run data get entity @e[type=minecart,tag=ir_cart,limit=1] Pos[0] 1

# The signed speed context (.curtgt): the cruise the pace obeys right now
# WITH its sign -- positive = eastbound, 0 = parked, negative = reverse
# (stop-and-reverse, §6.10). Same context pick as the shared speed_step.
# The minecart max-speed gamerule only ever holds the MAGNITUDE (speed_push
# takes |value|), so the sign lives here: it drives the stall keeper's boost
# direction below, the watchdog's direction awareness (pace_watch/pace_fix),
# the ocean gate and the reverse chunk roller.
scoreboard players operation .curtgt ir = .speed ir
execute if score .fast ir matches 1 run scoreboard players operation .curtgt ir = .ocnspd ir
execute if score .SKYMODE ir matches 1 run scoreboard players operation .curtgt ir = .skyspd ir
# A direction flip re-baselines the watchdog window (a half-east half-west
# 3-second window nets ~zero movement and would read as a false stall) and
# re-arms the reverse roller's trigger.
scoreboard players set .tgs ir 0
execute if score .curtgt ir matches 1.. run scoreboard players set .tgs ir 1
execute if score .curtgt ir matches ..-1 run scoreboard players set .tgs ir -1
execute unless score .tgsW ir = .tgsW ir run scoreboard players operation .tgsW ir = .tgs ir
execute unless score .tgs ir = .tgsW ir run scoreboard players set .wdt ir 0
execute unless score .tgs ir = .tgsW ir run scoreboard players set .wdstuck ir 0
execute unless score .tgs ir = .tgsW ir run scoreboard players reset .backLoad ir
execute unless score .tgs ir = .tgsW ir if entity @e[type=minecart,tag=ir_cart,limit=1] store result score .wdX ir run data get entity @e[type=minecart,tag=ir_cart,limit=1] Pos[0] 10
scoreboard players operation .tgsW ir = .tgs ir

# Reverse: keep chunks loading BEHIND (west of) the pace cart -- the forward
# roll released everything ≳256 back, and a cart entering non-ticking chunks
# freezes. Every 16 blocks of westward travel, rev_roll re-adds the corridor
# rows around/ahead-of the cart (already-generated chunks: cheap loads).
# Nothing is released until stop/begin clears all forceloads -- bounded, as
# a reverse run itself is (the ~2048-column history; rev_check below).
execute if score .curtgt ir matches ..-1 unless score .backLoad ir = .backLoad ir run scoreboard players operation .backLoad ir = .cartX ir
execute if score .curtgt ir matches ..-1 if score .cartX ir <= .backLoad ir at @e[type=minecart,tag=ir_cart,limit=1] run function infinite_rail:rev_roll

# Reverse end-stop: park the ride when it reaches the start (west end) of
# the remembered track.
execute if score .curtgt ir matches ..-1 run function infinite_rail:rev_check

# Ocean speed-up: sample the biome once per chunk crossed and raise/lower the
# minecart max-speed gamerule over long ocean stretches.
function infinite_rail:ocean_check

# Keepers: enforce who sits where. Only the plug may ride the pace cart (an
# empty cart scoops up passing mobs and can be entered by right-click), and
# only players may ride the ride cart. Ejections first; the mounts below
# self-heal the rest.
execute as @e[type=minecart,tag=ir_cart,limit=1] on passengers unless entity @s[type=item_display,tag=ir_plug] run ride @s dismount
execute as @e[type=minecart,tag=ir_ride,limit=1] on passengers unless entity @s[type=player] run ride @s dismount

# Keeper: re-mount a dismounted rider (sneak-dismounts, relogs) -- into the
# ride cart normally, or straight onto the seat while the cart is hidden
# (.HIDECART -- mode_hidecart_on; the seat is also how the rider changes
# perch on each toggle). (This re-triggers the vanilla dismount hint --
# unavoidable, but it only ever happens on a self-dismount or a toggle.)
execute if score .HIDECART ir matches 0 as @a[gamemode=adventure] unless data entity @s RootVehicle run ride @s mount @e[type=minecart,tag=ir_ride,limit=1]
execute if score .HIDECART ir matches 1 as @a[gamemode=adventure] unless data entity @s RootVehicle run ride @s mount @e[type=item_display,tag=ir_seat,limit=1]

# Keeper: while the cart is hidden, no ride cart may linger (belt +
# suspenders -- mode_hidecart_on already kills it).
execute if score .HIDECART ir matches 1 run kill @e[type=minecart,tag=ir_ride]

# Keeper: prevent the ride cart from visually tilting due to the minecart_improvements experiment.
execute as @e[type=minecart,tag=ir_ride,limit=1] run data modify entity @s Rotation[1] set value 0.0f

# Keeper: no creature may crowd the pace cart -- entities physically shove a
# minecart around, and a mob pile can slow or stall it outright. The rider is
# (.PACE_CART_BEHIND - .RIDER_BEHIND) blocks ahead, so nothing here is ever seen or heard. Every entity
# kind the ride itself uses is excluded (pace/ride carts, the plug/seat
# displays, the support-disguise block_displays, the head/probe markers);
# the kill sweeping up nearby dropped items/orbs too is fine -- doTileDrops
# is off and nobody is looking.
execute at @e[type=minecart,tag=ir_cart,limit=1] run kill @e[type=!player,type=!minecart,type=!marker,type=!item_display,type=!block_display,distance=..8]

# Keeper: the pace cart must never run through liquid -- water drags a
# minecart to a crawl and lava sets everything on fire. Clear any water/lava
# from the cart's cell and the one ahead of it (each plus the cell above --
# the cart is about a block tall). Flowing water can't waterlog the rails
# themselves (waterlogging only happens at placement), so clearing the open
# cells is the whole job; adjacent sources re-flow, but this runs every tick.
execute at @e[type=minecart,tag=ir_cart,limit=1] align xyz run fill ~ ~ ~ ~1 ~1 ~ minecraft:air replace minecraft:water
execute at @e[type=minecart,tag=ir_cart,limit=1] align xyz run fill ~ ~ ~ ~1 ~1 ~ minecraft:air replace minecraft:lava

# Keeper: vaporize dropped items and XP orbs before the rider glides into
# pickup range -- the inventory keeper deletes pickups instantly, but the
# pickup SOUND still plays; killing them ahead of time keeps the ride silent.
execute at @e[type=item_display,tag=ir_seat,limit=1] run kill @e[type=item,distance=..16]
execute at @e[type=item_display,tag=ir_seat,limit=1] run kill @e[type=experience_orb,distance=..16]

# Keeper: intercept hostile projectiles before they can hit the rider. A hit
# lands as 0 damage (Resistance 255 + the damage gamerules) but STILL plays
# the player-hurt "oof" -- and a command can only react at the next tick
# boundary, by which time the sound's onset (the part you actually hear) has
# already played. So the fix is to stop the hit from happening at all: every
# projectile within 6 blocks of the seat is killed each tick -- 6 exceeds the
# farthest an arrow can close on the rider in one tick (~3.2 blocks of arrow
# flight plus the ride's own motion), so nothing crosses the bubble between
# ticks. Skeletons still aim and shoot (the aggro ambience is untouched);
# their arrows just vanish silently at the last moment. The ids live in
# #infinite_rail:projectiles with required:false entries, so a renamed entity
# degrades to "that projectile can hit again", never a broken selector.
# (Bedrock doesn't need this -- its resource pack silences game.player.hurt
# outright, which a Java data pack cannot do.)
execute at @e[type=item_display,tag=ir_seat,limit=1] run kill @e[type=#infinite_rail:projectiles,distance=..6]

# Keeper: cut the tail of any player-hurt "oof" that still gets through
# (melee reach-ups, creeper blasts -- the projectile sweep above prevents the
# common ranged case entirely). A tick-boundary stopsound can only trim what
# is already playing, so this is a mitigation for the rare residual hit, not
# the fix. Deliberately NOT invisibility, which would blind mobs and kill the
# aggro ambience -- the rider takes no real damage either way.
stopsound @a[tag=ir_rider] * minecraft:entity.player.hurt

# Keeper: police the rider's inventory (give_menu): anything beyond the six
# pinned hotbar items is wiped, and a missing/wrong pinned item is re-pinned
# in place. (A blanket clear + re-give every tick used to re-fire the
# client's item-pickup animation nonstop, freezing every hotbar icon on the
# animation's first -- stretched -- frame.)
execute as @a[gamemode=adventure] run function infinite_rail:give_menu

# Keepers: plug on the pace cart, ride cart on the seat. Non-player
# passengers expose no vehicle tag to query, so the mount attempt itself is
# the check -- it just fails silently while already seated.
ride @e[type=item_display,tag=ir_plug,limit=1] mount @e[type=minecart,tag=ir_cart,limit=1]
ride @e[type=minecart,tag=ir_ride,limit=1] mount @e[type=item_display,tag=ir_seat,limit=1]

# Keeper: if the pace cart ever stalls (mob collision, freak accident),
# re-boost it -- in the direction the signed target says the ride is going
# (stop-and-reverse): east while .curtgt is positive, west while negative,
# and while PARKED (.curtgt 0) any creeping motion is zeroed outright (the
# gamerule may sit at 0 too, but a version that rejects 0 leaves it nonzero
# -- the per-tick zeroing is what guarantees a parked ride holds still; a
# cart at rest on a powered rail is not re-accelerated by it).
execute store result score .mx ir run data get entity @e[type=minecart,tag=ir_cart,limit=1] Motion[0] 100
execute if score .curtgt ir matches 1.. if score .mx ir matches ..10 run data merge entity @e[type=minecart,tag=ir_cart,limit=1] {Motion:[0.5d,0.0d,0.0d]}
execute if score .curtgt ir matches ..-1 if score .mx ir matches -10.. run data merge entity @e[type=minecart,tag=ir_cart,limit=1] {Motion:[-0.5d,0.0d,0.0d]}
execute if score .curtgt ir matches 0 if score .mx ir matches 3.. run data merge entity @e[type=minecart,tag=ir_cart,limit=1] {Motion:[0.0d,0.0d,0.0d]}
execute if score .curtgt ir matches 0 if score .mx ir matches ..-3 run data merge entity @e[type=minecart,tag=ir_cart,limit=1] {Motion:[0.0d,0.0d,0.0d]}

# Watchdog: the motion re-boost above can't help a cart that DERAILED (fell
# off the track end into terrain when chunk loading lagged) or vanished --
# pace_watch compares the cart's X across 3-second windows (60 ticks) and,
# when it stopped going anywhere, snaps it back onto the built track
# (pace_fix). Runs before cam_follow so a recovery moves cart and rig in
# the same tick.
scoreboard players add .wdt ir 1
execute if score .wdt ir matches 60.. run function infinite_rail:pace_watch

# Invisible track (mode_hidetrack_* / .HIDETRACK): keep the pace cart's
# just-in-time rail strip rolling under it across invisible columns (free
# until the ride has ever built one -- see invis_tick).
function infinite_rail:invis_tick

# Smooth camera: fly the rig along the recorded profile ahead of the pace cart.
execute if entity @e[type=minecart,tag=ir_cart,limit=1] run function infinite_rail:cam_follow

# Minecart sound (mode_sound_* / .SOUNDMODE): re-trigger the vanilla
# first-person riding sample at the rider on a 115-tick clock (the exact
# length of entity.minecart.inside -- sound_loop plays it at a huge volume
# so it never fades as the ride glides). A pure /playsound loop, no cart or
# resource pack involved.
execute if score .SOUNDMODE ir matches 1 run scoreboard players add .sndt ir 1
execute if score .SOUNDMODE ir matches 1 if score .sndt ir matches 115.. run function infinite_rail:sound_loop

# Loud diagnostic for build_loop's head gate: a head marker that stays
# unselectable (its chunk unloaded / not entity-ticking) means building is
# PAUSED, which usually means chunk force-loading is failing on this game
# version. Warn once after 5 continuous seconds; the counter resets on
# recovery, so a later relapse warns again.
execute unless entity @e[type=marker,tag=ir_head,limit=1] run scoreboard players add .hdmiss ir 1
execute if entity @e[type=marker,tag=ir_head,limit=1] run scoreboard players set .hdmiss ir 0
execute if score .hdmiss ir matches 100 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Warning: the track builder's head is in unloaded chunks, so building is paused until its terrain loads. If this keeps happening, chunk force-loading may be broken on this Minecraft version - please report it.","color":"yellow"}]

# The chunk roll's phase machine (roll_phase): one slice of the 16-block
# roll per odd tick while a cycle is armed (.rollP -- see roll_chunks for
# the split). Runs at the head like the roll itself, so a missing head
# pauses the cycle exactly like it pauses building, and resumes with it.
execute if score .rollP ir matches 1.. at @e[type=marker,tag=ir_head,limit=1] run function infinite_rail:roll_phase

# Extend the track ahead of the pace cart. The per-tick column budget is
# auto-scaled to the ride's current speed (build_budget: ceil of the active
# cruise x .BUILD_FACTOR / 20, floored at 1, raised further if the cart's
# measured motion says a hand-set gamerule is going faster) -- so catch-up
# bursts cost a small multiple of what the ride consumes, never a flat
# worst-case spike. Uses .mx from the stall keeper above.
function infinite_rail:build_budget
function infinite_rail:build_loop
