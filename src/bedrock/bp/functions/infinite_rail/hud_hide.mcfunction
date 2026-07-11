# Hide the HUD:  /function infinite_rail/hud_hide  (the Toggle HUD item)
# Hides every HUD element, then puts item_text -- the temporary item-name
# popup -- back, so scrolling the hotbar still flashes the pinned items'
# names and the rider can tell what they're holding with the bar invisible.
# The held Toggle HUD item itself renders as NOTHING (the RP binds the empty
# geometry to infinite_rail:toggle_hud as an attachable), so the view is
# completely clean. State like a mode (.HUDHIDDEN persists); hud_show and
# the script's stop() run `hud @a reset all` to undo it.
hud @a hide all
hud @a reset item_text
scoreboard players set .HUDHIDDEN ir 1
tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7HUD hidden - use the Toggle HUD item again to bring it back."}]}
