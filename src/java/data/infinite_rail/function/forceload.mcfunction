# Macro helper for roll_chunks: forceload the corridor from the head out to
# $(gen) blocks ahead of it, and release the band far behind. forceload only
# accepts literal/relative coordinates (not scoreboard values), so the forward
# distance is passed in as the macro argument $(gen). Runs positioned at the
# head marker (position is inherited from the caller).
$forceload add ~ ~-8 ~$(gen) ~8
forceload remove ~-336 ~-8 ~-256 ~8
