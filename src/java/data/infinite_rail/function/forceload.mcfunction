# Macro helper for forceload_here: forceload the corridor from the head out
# to $(gen) blocks ahead of it and $(w) blocks to each side, and release the
# band far behind. forceload only accepts literal/relative coordinates (not
# scoreboard values), so both distances arrive as macro arguments. $(w) is 8
# (+-1 chunk) normally, and the clamped #TORCHRANGE while torch mode may
# throw torches past the standard band (see forceload_here).
# The remove band's +-64 half-width is fixed and generous on purpose: it
# covers every width the add line can have used (releasing a chunk that was
# never forced is a no-op), so lowering #TORCHRANGE mid-ride can never
# strand wide chunks loaded behind the ride. Runs positioned at the head
# marker (position is inherited from the caller).
$forceload add ~ ~-$(w) ~$(gen) ~$(w)
forceload remove ~-336 ~-64 ~-256 ~64
