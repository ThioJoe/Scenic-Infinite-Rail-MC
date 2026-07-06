# Mode toggle:  /function infinite_rail/mode_hidecart_off
# Show the minecart again: scripts/main.js sees the score flip and resumes
# gliding the cart prop at the config .CARTYOFF offset (read live every
# tick, so the restore is automatic and honors any config edit).
scoreboard players set .HIDECART ir 0
tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Minecart visible again."}]}
