# Seeds the ride-mode toggle scores WITHOUT touching a mode that is already
# set: "add 0" creates a missing score and leaves an existing one alone
# (the two non-zero defaults -- .TORCHMODE and .SOUNDMODE -- use a one-shot
# companion flag instead, below). Modes are STATE, not config -- they are
# flipped by the mode_* functions, survive /reload (config.mcfunction
# re-runs on every reload and would reset them if they lived there), and
# persist in the world save like every other ir score.
# Called once per load: from load.mcfunction on Java, from the script's
# init() on Bedrock.
# .NIGHTMODE is a TRI-STATE: 0 = default day/night cycle, 1 = night only
# (frozen midnight), 2 = day only (frozen noon).
scoreboard players add .RAINMODE ir 0
scoreboard players add .NIGHTMODE ir 0
scoreboard players add .SKYMODE ir 0
# .TORCHMODE is a TRI-STATE with a NON-ZERO default: 0 = off, 1 = always
# on, 2 = auto (torches only while it is night -- the shared torch_auto
# answers per column). Add-0 seeding can't produce a 2, so it gets the same
# one-shot companion-flag treatment as .SOUNDMODE below (.trchinit): the
# default is written only on the load that first creates the flag, then a
# menu/command choice owns the score forever after. The extra
# .TORCHMODE-is-0 condition is for worlds UPGRADING from the on/off era: a
# deliberately switched-on 1 stays on; only off/never-set becomes auto.
scoreboard players add .TORCHMODE ir 0
scoreboard players add .trchinit ir 0
execute if score .trchinit ir matches 0 if score .TORCHMODE ir matches 0 run scoreboard players set .TORCHMODE ir 2
execute if score .trchinit ir matches 0 run scoreboard players set .trchinit ir 1
# .HIDECART: 1 = the visible minecart is removed and the rider floats on the
# invisible seat alone (Java re-seats the rider onto the seat itself;
# Bedrock just stops spawning the scenery cart prop).
scoreboard players add .HIDECART ir 0

# The minecart-sound toggle (.SOUNDMODE -- each edition's clock re-triggers
# the vanilla rolling sound at the rider while it is 1) is a mode like the
# ones above, but with a config-side DEFAULT (.CARTSOUND) instead of a fixed
# 0 -- so it can't use plain add-0 seeding: for a 0/1 toggle, "never set"
# and "off" are the same number. A one-shot companion flag (.sndinit) tells
# them apart: the default is copied only on the load that first creates the
# flag, then never again, so a menu choice survives /reload, ride restarts
# and rejoins exactly like every other mode.
scoreboard players add .sndinit ir 0
execute if score .sndinit ir matches 0 run scoreboard players operation .SOUNDMODE ir = .CARTSOUND cfg_ride
execute if score .sndinit ir matches 0 run scoreboard players set .sndinit ir 1

# Mobs aggro (.AGGROMODE): 1 = hostile mobs can see the rider and react --
# creepers sneak up and hiss, skeletons draw their bows -- the vanilla
# ambience, and the default; 0 = an invisibility effect on the rider makes
# mobs ignore the ride (on Bedrock invisible players are completely
# undetectable; the same effect is also what hides the Bedrock first-person
# arm, the job of the retired .HIDEHAND knob). The effect itself is applied
# natively per edition (Java mode_aggro_*/launch_done, Bedrock's keeper).
# A non-zero default, so it seeds with a one-shot flag like .SOUNDMODE.
scoreboard players add .AGGROMODE ir 0
scoreboard players add .agginit ir 0
execute if score .agginit ir matches 0 run scoreboard players set .AGGROMODE ir 1
execute if score .agginit ir matches 0 run scoreboard players set .agginit ir 1

# The adjustable ride speed (.speed -- see the shared speed_step) is state
# like the modes: seed it from the config default only when it has never
# been set (or was left at an invalid <= 0), so a speed chosen with the
# Speed +/- items survives /reload, ride restarts and rejoins. Runs after
# config on both editions, so .MAXSPEED is already applied here.
scoreboard players add .speed ir 0
execute if score .speed ir matches ..0 run scoreboard players operation .speed ir = .MAXSPEED cfg_ride

# Torch density (.torchdens -- the roll place_torch/maybeTorch actually
# uses) follows the same pattern: seeded from the config default .TORCHODDS
# only when never set, then owned by the Visual Settings menu's presets (the
# torch_density_* functions: Low 15 / Medium 35 / High 70 / Max 100), so a
# chosen density survives /reload, ride restarts and rejoins.
scoreboard players add .torchdens ir 0
execute if score .torchdens ir matches ..0 run scoreboard players operation .torchdens ir = .TORCHODDS cfg_ride
