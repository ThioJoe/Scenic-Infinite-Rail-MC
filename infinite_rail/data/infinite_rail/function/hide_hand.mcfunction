# Bedrock-only: hide the rider's hand / held item for an unobstructed view.
#
# The /hud command exists only on Bedrock Edition. On Java Edition this command
# is unknown, so this whole file fails to compile and is silently dropped from
# the pack (calling it is then a harmless no-op) -- exactly like the
# setup_world / setup_world_26 gamerule split. Called once from begin, as the
# rider (@s), so a Bedrock port of this pack starts with the hand already
# hidden; on Java it does nothing.
hud @s hide hand
