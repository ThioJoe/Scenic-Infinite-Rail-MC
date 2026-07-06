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

# The adjustable ride speed (.speed -- see the shared speed_step) is state
# like the modes: seed it from the config default only when it has never
# been set (or was left at an invalid <= 0), so a speed chosen with the
# Speed +/- items survives /reload, ride restarts and rejoins. Runs after
# config on both editions, so .MAXSPEED is already applied here.
scoreboard players add .speed ir 0
execute if score .speed ir matches ..0 run scoreboard players operation .speed ir = .MAXSPEED cfg_ride

# Torch density (.torchdens -- the roll place_torch/maybeTorch actually
# uses) follows the same pattern: seeded from the config default .TORCHODDS
# only when never set, then owned by the Settings menu's presets (the
# torch_density_* functions: Low 15 / Medium 35 / High 70 / Max 100), so a
# chosen density survives /reload, ride restarts and rejoins.
scoreboard players add .torchdens ir 0
execute if score .torchdens ir matches ..0 run scoreboard players operation .torchdens ir = .TORCHODDS cfg_ride
