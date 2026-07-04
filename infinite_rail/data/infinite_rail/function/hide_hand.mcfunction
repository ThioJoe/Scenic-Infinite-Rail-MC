# Bedrock-only: hide the rider's hand / held item for an unobstructed view.
#
# The /hud command exists only on Bedrock Edition. On Java Edition this command
# is unknown, so this whole file fails to compile and is silently dropped from
# the pack (calling it is then a harmless no-op). This stays a compile-drop
# rather than a pack.mcmeta overlay because it's an EDITION difference (Bedrock
# vs Java), not a Java-version one -- overlays key on the data-pack format, and
# Bedrock doesn't read Java overlays at all. Called once from begin, as the
# rider (@s), so a Bedrock port of this pack starts with the hand already
# hidden; on Java it does nothing.
hud @s hide hand
