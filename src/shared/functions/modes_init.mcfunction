# Seeds the ride-mode toggle scores at 0 (off) WITHOUT touching a mode that
# is already set: "add 0" creates a missing score and leaves an existing one
# alone. Modes are STATE, not config -- they are flipped by the mode_*
# functions, survive /reload (config.mcfunction re-runs on every reload and
# would reset them if they lived there), and persist in the world save like
# every other ir score.
# Called once per load: from load.mcfunction on Java, from the script's
# init() on Bedrock.
# .NIGHTMODE is a TRI-STATE: 0 = default day/night cycle, 1 = night only
# (frozen midnight), 2 = day only (frozen noon).
scoreboard players add .RAINMODE ir 0
scoreboard players add .NIGHTMODE ir 0
scoreboard players add .TORCHMODE ir 0
scoreboard players add .SKYMODE ir 0
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
