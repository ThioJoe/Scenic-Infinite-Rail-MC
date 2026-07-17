# Reports the just-recomputed active cruise speed (.spcur -- the shared
# speed_step wrote it: the sky cruise .skyspd while sky mode owns the ride,
# else the land speed .speed), with "(default)" when it equals the active
# config default (.spdflt). No apply here: scripts/main.js reads .speed /
# .skyspd as the virtual pace target every tick, so there is no gamerule to
# push on Bedrock.
# Negative values print with their minus sign as-is; 0 says so ("stopped").
execute if score .spcur ir matches 0 run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Ride speed: §f"},{"score":{"name":".spcur","objective":"ir"}},{"text":"§7 blocks/s (stopped)"}]}
execute unless score .spcur ir matches 0 if score .spdflt ir matches 0 run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Ride speed: §f"},{"score":{"name":".spcur","objective":"ir"}},{"text":"§7 blocks/s"}]}
execute unless score .spcur ir matches 0 if score .spdflt ir matches 1 run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Ride speed: §f"},{"score":{"name":".spcur","objective":"ir"}},{"text":"§7 blocks/s (default)"}]}
