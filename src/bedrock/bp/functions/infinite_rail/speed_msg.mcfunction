# Reports the adjusted land cruising speed (.speed -- the shared speed_step
# just recomputed it), with "(default)" when it equals the config .MAXSPEED
# (.spdflt). No apply here: scripts/main.js reads .speed as the virtual pace
# target every tick, so there is no gamerule to push on Bedrock.
execute if score .spdflt ir matches 0 run tellraw @a {"rawtext":[{"text":"§6[Infinite Rail]§r §7Ride speed: §f"},{"score":{"name":".speed","objective":"ir"}},{"text":"§7 blocks/s"}]}
execute if score .spdflt ir matches 1 run tellraw @a {"rawtext":[{"text":"§6[Infinite Rail]§r §7Ride speed: §f"},{"score":{"name":".speed","objective":"ir"}},{"text":"§7 blocks/s (default)"}]}
