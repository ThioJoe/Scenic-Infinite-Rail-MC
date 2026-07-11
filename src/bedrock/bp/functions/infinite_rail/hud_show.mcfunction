# Show the HUD again:  /function infinite_rail/hud_show  (the Toggle HUD
# item; the pair of hud_hide). Resets every element /hud can have hidden --
# harmless when nothing was: a client-side F1 hide is a different mechanism
# and is untouched either way.
hud @a reset all
scoreboard players set .HUDHIDDEN ir 0
tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7HUD restored."}]}
