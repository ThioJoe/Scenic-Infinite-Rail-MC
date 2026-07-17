# The reverse chunk roller (stop-and-reverse, §6.10): while the ride runs
# BACKWARDS, re-forceload the corridor around and behind (west of) the pace
# cart -- the forward roll released everything ≳256 blocks back, and a
# minecart entering non-ticking chunks simply freezes (which would stall the
# whole ride ~32 blocks into any reverse run). Runs positioned AT the cart,
# every 16 blocks of westward travel (main's .backLoad trigger): re-add the
# strip's rows from 64 ahead of the travel direction (west) to 16 behind.
# The chunks were all generated on the way out, so these adds are cheap
# loads, not fresh generation. Nothing is RELEASED while reversing -- the
# forward roll's release band only ever tiles eastward, so chunks re-added
# here stay force-loaded until the next `stop`/`begin` clears every
# forceload; bounded, because a reverse run is itself bounded by the ~2048-
# column track history (the ride stops at its west end -- rev_check).
forceload add ~-64 ~-15 ~16 ~15
scoreboard players remove .backLoad ir 16
