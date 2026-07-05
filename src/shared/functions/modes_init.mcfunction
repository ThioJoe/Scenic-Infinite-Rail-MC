# Seeds the ride-mode toggle scores at 0 (off) WITHOUT touching a mode that
# is already set: "add 0" creates a missing score and leaves an existing one
# alone. Modes are STATE, not config -- they are flipped by the mode_*
# functions, survive /reload (config.mcfunction re-runs on every reload and
# would reset them if they lived there), and persist in the world save like
# every other ir score.
# Called once per load: from load.mcfunction on Java, from the script's
# init() on Bedrock.
scoreboard players add .RAINMODE ir 0
scoreboard players add .NIGHTMODE ir 0
scoreboard players add .TORCHMODE ir 0
scoreboard players add .SKYMODE ir 0
