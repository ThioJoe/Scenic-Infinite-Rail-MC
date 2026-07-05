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
# Disable all environmental damage to ensure true invulnerability.
gamerule falldamage false
gamerule firedamage false
gamerule freezedamage false
gamerule drowningdamage false
# If something impossible happens, come straight back (spawnpoint follows the ride).
gamerule doimmediaterespawn true
# Keep the spawn-protection area from anchoring chunks at the origin.
gamerule spawnradius 0
