# Entry point: run /function infinite_rail:start (by a player, or from a
# command block / console with a player online). The ride begins at the
# nearest player's position, heading east forever.
execute as @p at @s align xz run function infinite_rail:begin
