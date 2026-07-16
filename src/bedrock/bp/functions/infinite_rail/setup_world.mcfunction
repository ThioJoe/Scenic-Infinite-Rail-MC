# One-time world tuning for a clean, unbreakable, quiet ride -- Bedrock copy.
# Bedrock gamerule names differ from both Java eras, so this file is Bedrock-
# specific (the Java copies live in src/java, base + overlay_snake). Keep the
# three copies in sync when changing a rule.
# Called once from the script's begin() via runCommand.
gamerule sendcommandfeedback false
gamerule commandblockoutput false
# Creepers/endermen must never damage the track.
gamerule mobgriefing false
# No fire creeping onto the line, no phantoms circling the cart.
gamerule dofiretick false
gamerule doinsomnia false
# Prevent blocks broken by the track builder from dropping items.
gamerule dotiledrops false
# No mob death drops either (cross-edition parity with the Java copies): the
# rider can never collect items (inventory keeper), sweepDrops kills drops
# near the seat only for the pickup SOUND, and passed drops otherwise linger
# beside the track until the corridor cull reaches them.
gamerule domobloot false
# Disable all environmental damage to ensure true invulnerability.
gamerule falldamage false
gamerule firedamage false
gamerule freezedamage false
gamerule drowningdamage false
# If something impossible happens, come straight back (spawnpoint follows the ride).
gamerule doimmediaterespawn true
# Keep the spawn-protection area from anchoring chunks at the origin.
gamerule spawnradius 0
# No recipe unlocking (every unlock pops a toast + chat line; false = the
# classic everything-available recipe book), and silence any recipe message
# that would still slip through. Bedrock-only rules -- Java has neither, so
# its begin pre-unlocks all recipes instead.
gamerule recipesunlock false
gamerule showrecipemessages false
# Tutorial-hint suppression (`gametips disable`) is NOT run here: /gametips is
# a device-scoped command with no server/world form, so it is unparseable in a
# function invoked via dim.runCommand (no player executor) -- and one bad line
# makes Bedrock reject the WHOLE function at load, silently dropping every
# gamerule above (phantoms, damage, fire, mobgriefing...). It is instead run
# once as the seated rider in the script's launch step (rider.runCommand), the
# only context /gametips accepts.
