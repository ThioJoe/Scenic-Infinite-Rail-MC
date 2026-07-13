# One block of the window walk (see sample_window): pop the next cached
# height off the scratch copy; every .SAMPLE_BLOCK_INTERVAL-th block is a
# sample (sample_fold: lazy probe of a never-read slot, void fallback,
# down-clamp, accumulate). Recurses until .winn samples are folded.
execute store result score .s ir run data get storage infinite_rail:surf w[0]
data remove storage infinite_rail:surf w[0]
scoreboard players add .wo ir 1
scoreboard players remove .wc ir 1
execute if score .wc ir matches ..0 run function infinite_rail:sample_fold
execute if score .wk ir < .winn ir run function infinite_rail:sample_step
