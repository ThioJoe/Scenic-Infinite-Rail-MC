# One-time world tuning for a clean, unbreakable, quiet ride.
#
# VERSION NOTE: this is the BASE (camelCase) copy, used on data-pack formats
# 82-91. Snapshot 25w44a (format 92+, the 26.x era) renamed every gamerule to
# snake_case, so on those versions the `overlay_snake` overlay replaces this
# whole file with its snake_case twin (see pack.mcmeta). begin calls
# `setup_world` once; whichever copy is active for the running version runs.
# Keep the base and overlay copies in sync when changing a rule.
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
# Prevent blocks broken by the track builder (like unsupported torches) from dropping items.
gamerule doTileDrops false
# Disable all environmental damage to ensure true invulnerability (no damage sounds or fire screen).
gamerule fallDamage false
gamerule fireDamage false
gamerule freezeDamage false
gamerule drowningDamage false
# If something impossible happens, come straight back (spawnpoint follows the ride).
gamerule doImmediateRespawn true
# Explicit success for begin/load's store-success health check (.swok): a
# function without a /return stores success 0 on modern versions, identical
# to "the file failed to compile" -- and a single bad gamerule name DOES
# fail this whole file (the do_tile_drops era shipped worlds with NO ride
# gamerules at all: phantoms circling the night ride was the symptom).
return 1
