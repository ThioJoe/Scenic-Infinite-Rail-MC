# Player entry point -- same command as Java, modulo the / path separator:
#   /function infinite_rail/start
# Bedrock functions cannot call into the Script API synchronously, so this is
# a one-line bridge: it fires a script event that scripts/main.js listens for
# (system.afterEvents.scriptEventReceive) and starts the ride at the nearest
# player, exactly like Java's start.mcfunction does via execute as @p.
# (Bedrock's /scriptevent requires a message argument; the script only reads
# the id, so "go" is a throwaway.)
scriptevent infinite_rail:start go
