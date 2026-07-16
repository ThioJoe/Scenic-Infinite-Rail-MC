# Phase 7 of the roll (roll_phase): the TORCH STUB -- the wide (±.fw) but
# short (~-16..~+32 in X) force-add around the head that keeps thrown
# torches landing in loaded, generated chunks while torches are actively
# planting (see the forceload macro's header for the stub/band split's
# rationale). Width from the shared torch_width (1 = not planting, the add
# is a no-op). Failures here are routine and deliberately unmonitored --
# the .flok health signal belongs to the center-row add alone (phase 1).
function infinite_rail:torch_width
execute store result storage infinite_rail:args w int 1 run scoreboard players get .fw ir
function infinite_rail:roll_stub_at with storage infinite_rail:args
