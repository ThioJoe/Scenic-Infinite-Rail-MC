# The Toggle HUD hotbar item's dispatcher:  /function infinite_rail/hud_toggle
# Bedrock-only -- a Java ride is always on a PC, where F1 hides the HUD
# natively; /hud is Bedrock's command. Flips between hud_hide and hud_show
# on the .HUDHIDDEN state score (self-seeded here -- it's Bedrock-only, so
# the shared modes_init doesn't know it). The score is copied to a temp
# first: the branch that runs flips .HUDHIDDEN itself, so branching on the
# live score would run BOTH branches. A HUD hidden some other way (F1 is
# client-side; /hud can't see it) just costs one harmless "restore" click.
scoreboard players add .HUDHIDDEN ir 0
scoreboard players operation .hudt ir = .HUDHIDDEN ir
execute if score .hudt ir matches 0 run function infinite_rail/hud_hide
execute if score .hudt ir matches 1.. run function infinite_rail/hud_show
