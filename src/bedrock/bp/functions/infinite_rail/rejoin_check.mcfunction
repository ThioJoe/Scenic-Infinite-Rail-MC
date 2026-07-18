# The world-rejoin unpark check's Bedrock wrapper, run by the script's
# playerSpawn (initialSpawn) handler when a player joins a world whose ride
# is resumed (scripts/main.js gates on S.started before calling). The
# decision is the shared speed_rejoin (see its header): if the ACTIVE cruise
# speed persisted as exactly 0 (parked -- stop-and-reverse state), it is
# returned to that cruise's config default, so a player who forgot they
# stopped the cart doesn't rejoin to a ride that looks broken. No apply
# step here: the script reads .speed/.ocnspd/.skyspd as the virtual pace
# target every tick, so the score write is the whole change -- only the
# "why is it moving again" message is native.
function infinite_rail/speed_rejoin
execute if score .spfix ir matches 1 run tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7The ride was parked at speed 0 last session -- resuming at the default §f"},{"score":{"name":".spcur","objective":"ir"}},{"text":"§7 blocks/s."}]}
