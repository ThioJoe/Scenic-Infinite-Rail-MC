# (a function macro) Runs torch_try at the rolled side spot: $(dz) is the
# SIGNED Z offset from the centerline (storage infinite_rail:torch dz, set by
# place_torch -- distance and side in one number). Coordinates can't come
# from scoreboards, which is the whole reason for this hop through a macro.
# Runs positioned at the head (inherited from the caller).
$execute positioned ~ ~ ~$(dz) run function infinite_rail:torch_try
