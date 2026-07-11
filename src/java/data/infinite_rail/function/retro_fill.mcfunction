# (a function macro) The retroactive center-bore clear behind the head when a
# slope starts (see retro_clear, which computes and stores the args): columns
# ~-k..~0 at the current rail level, from 2 above the rail to the top of the
# flat bore. fill needs literal coordinates, so both distances arrive as
# macro args (storage infinite_rail:carve k and h).
# The fill only replaces VEGETATION (#infinite_rail:keep) -- that is the
# whole point of the retro clear (the camera floats above the rail line
# around slopes, so plants spared over these columns must go after all),
# and the only other thing in an already-carved bore is the pack's own
# track light at ~3, which a bare air-fill used to DELETE: every slope
# start left the .SLOPECLEAR columns behind it dark.
$fill ~-$(k) ~2 ~ ~ ~$(h) ~ minecraft:air replace #infinite_rail:keep
