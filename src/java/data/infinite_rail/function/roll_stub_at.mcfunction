# Macro half of roll_stub: forceload only accepts literal/relative
# coordinates, so the stub's Z half-width arrives as a macro arg.
$forceload add ~-16 ~-$(w) ~32 ~$(w)
