# One-time world tuning for a clean, unbreakable, quiet ride.
#
# VERSION NOTE: snapshot 25w44a (the 26.x era) renamed every gamerule to
# snake_case, so this file -- which uses the classic camelCase names -- fails
# to compile there and is silently skipped, while setup_world_26.mcfunction
# (the snake_case twin) compiles instead. begin calls BOTH: on any given
# version exactly one of the two files exists in memory and runs; the call to
# the other is a harmless runtime no-op. Keep the two files in sync when
# changing a rule.
gamerule sendCommandFeedback false
gamerule commandBlockOutput false
gamerule logAdminCommands false
gamerule announceAdvancements false
# Don't keep the original spawn chunks loaded; the ride never returns.
gamerule spawnChunkRadius 0
# Creepers/endermen must never damage the track.
gamerule mobGriefing false
# No fire creeping onto the line, no phantoms circling the cart.
gamerule doFireTick false
gamerule doInsomnia false
# If something impossible happens, come straight back (spawnpoint follows the ride).
gamerule doImmediateRespawn true
