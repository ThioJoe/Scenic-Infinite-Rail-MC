# Fold one sample into the window sum (see sample_window). The offset .wo is
# this sample's distance east of the head. A slot nobody ever probed
# (-32768) gets its one real probe here (surf_prep -- cached for every later
# column); a void/ungenerated read (<= -63, which a failed probe also
# reports) counts as the previous average; then the .DOWNCLAMP floor and the
# accumulate. Runs positioned at the head (surf_prep's probe offset is
# relative to it).
scoreboard players operation .wc ir = .wstep ir
scoreboard players add .wk ir 1
execute if score .s ir matches -32768 run scoreboard players operation .suo ir = .wo ir
execute if score .s ir matches -32768 run function infinite_rail:surf_prep
execute if score .s ir matches ..-63 run scoreboard players operation .s ir = .avg ir
execute if score .s ir < .lo ir run scoreboard players operation .s ir = .lo ir
scoreboard players operation .sum ir += .s ir
