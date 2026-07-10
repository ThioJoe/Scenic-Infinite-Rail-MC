# Macro helper for forceload_here: forceload the corridor from the head out
# to $(gen) blocks ahead of it and $(w) blocks to each side, and release the
# band far behind. forceload only accepts literal/relative coordinates (not
# scoreboard values), so both distances arrive as macro arguments. $(w) is 8
# (+-1 chunk) normally, and the clamped .TORCHRANGE while torch mode may
# throw torches past the standard band (see forceload_here).
# The remove band's +-64 half-width is fixed and generous on purpose: it
# covers every width the add line can have used (releasing a chunk that was
# never forced is a no-op), so lowering .TORCHRANGE mid-ride can never
# strand wide chunks loaded behind the ride. Runs positioned at the head
# marker (position is inherited from the caller).
#
# ORDER + `return run` MATTER: forceload_here store-successes this whole
# function into .flok, the chunk pipeline's health signal (roll_chunks warns
# once when it reads 0). On modern versions a function WITHOUT an explicit
# /return stores success 0 no matter what its commands did -- so the signal
# read "failing" on every ride even while forceloading demonstrably worked,
# and every ride start opened with a bogus one-shot warning. The remove runs
# first (its failure is routine: for the first ~336 blocks of a ride there
# is nothing behind to release), and the function RETURNS the add's own
# result -- the one command whose success actually means "the corridor
# ahead is loading". The add gains at least one brand-new chunk column per
# 16-block roll, so a healthy pipeline always answers 1.
forceload remove ~-336 ~-64 ~-256 ~64
$return run forceload add ~ ~-$(w) ~$(gen) ~$(w)
