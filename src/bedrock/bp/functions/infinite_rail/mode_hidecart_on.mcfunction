# Mode toggle:  /function infinite_rail/mode_hidecart_on
# Hide the minecart: the cart prop is not removed -- scripts/main.js watches
# the score and glides it at a fixed sink offset (HIDE_CARTYOFF, -0.5
# blocks, in place of the config .CARTYOFF) below the track line, where the
# track blocks hide it from the rider's perspective. State like every mode
# (.HIDECART persists). The rider's mount is untouched (they always sit on
# the invisible seat on Bedrock), so toggling is completely seamless here.
scoreboard players set .HIDECART ir 1
tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Minecart hidden - enjoy the unobstructed view."}]}
