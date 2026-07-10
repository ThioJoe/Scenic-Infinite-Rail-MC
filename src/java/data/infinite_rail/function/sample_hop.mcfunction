# One hop of the sample-window walk (see sample_window): move
# .SAMPLE_BLOCK_INTERVAL blocks east and take one sample there. A function
# macro because positions only accept literal/relative coordinates -- the
# hop distance arrives from storage infinite_rail:samp (written once per
# column by sample_window).
$execute positioned ~$(dx) ~ ~ run function infinite_rail:sample_step
