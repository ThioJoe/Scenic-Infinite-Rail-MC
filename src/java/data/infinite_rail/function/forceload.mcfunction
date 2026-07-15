# Macro helper for forceload_here: forceload the corridor at the current
# position (the head marker for roll_chunks, the starting player for begin)
# and release the band far behind. forceload only accepts literal/relative
# coordinates (not scoreboard values), so the distances arrive as macro
# arguments. TWO adds since the torch-band split:
#   - the TRACK BAND: +-15 blocks around the centerline out to the full
#     $(gen) = .TERRAIN_GENAHEAD reach -- the strip's own chunk row (the
#     Z ≡ 14 anchor keeps z-1..z+1 inside one row, §3) plus one full row
#     each side. The neighbors are NOT optional: forcing only the strip's
#     row was tried and STARVED the pipeline (sporadic head-gate pauses,
#     the cart running off the track end every few hundred ticks, measured
#     by the watchdog suite) -- a forced chunk only reaches its
#     entity-ticking state once the chunks around it are fully generated,
#     and leaving the neighbor rows to the ticket ladder's implicit
#     propagation kept losing the generation race under load. Forcing the
#     three-row box outright keeps the frontier reliably ahead of the
#     builder, and is still ~40% less area than the old full-length
#     5-row torch band.
#   - the TORCH STUB: +-$(w) blocks but only ~-16..~+32 in X. Torches only
#     ever land beside the column being BUILT (place_torch runs at the
#     head), so the wide band needs to cover the span built since the last
#     roll plus a couple of rolls of generation lead time -- never the full
#     corridor length. $(w) arrives as 1 while torches aren't actively
#     planting (the stub is then a no-op over already-forced row chunks),
#     and as the clamped .TORCHRANGE while they are (see forceload_here).
# Splitting the wide band out of the deep add is what keeps a catch-up
# burst's generation queue small: the track row's chunks are never queued
# behind four rows of torch scenery (~5x the area) that the builder does
# not need -- the exact situation (weak hardware, ultra speed) where
# generation lag derails the ride.
# The remove band's +-64 half-width is fixed and generous on purpose: it
# covers every width and shape the adds can have used (releasing a chunk
# that was never forced is a no-op), so lowering .TORCHRANGE mid-ride, a
# dawn narrowing, or the stub geometry itself can never strand wide chunks
# loaded behind the ride. Runs positioned at the head marker (position is
# inherited from the caller).
#
# ORDER + `return run` MATTER: forceload_here store-successes this whole
# function into .flok, the chunk pipeline's health signal (roll_chunks warns
# once when it reads 0). On modern versions a function WITHOUT an explicit
# /return stores success 0 no matter what its commands did -- so the signal
# read "failing" on every ride even while forceloading demonstrably worked,
# and every ride start opened with a bogus one-shot warning. The remove runs
# first (its failure is routine: for the first ~336 blocks of a ride there
# is nothing behind to release); the stub add runs second (ITS failure is
# routine too -- a narrow stub over already-forced band chunks adds nothing
# and answers 0, which must not pollute the signal); and the function
# RETURNS the track-band add's own result -- the one command whose success
# actually means "the corridor ahead is loading". The band add gains at
# least one brand-new chunk column per 16-block roll, so a healthy pipeline
# always answers 1.
forceload remove ~-336 ~-64 ~-256 ~64
$forceload add ~-16 ~-$(w) ~32 ~$(w)
$return run forceload add ~ ~-15 ~$(gen) ~15
