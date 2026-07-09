# Dispatches a Speed hotbar item right-click. Runs AS the clicking player
# (menu_tick fans out over everyone with an ir_click stat count). All three
# Speed items are carrot_on_a_sticks -- the one item whose "used" statistic
# increments on any right-click -- re-modeled to look like a rail / minecart /
# powered rail via the minecraft:item_model component, so the stat alone can't
# tell them apart: the custom_data component (ir_spd -1/0/+1) on whatever is
# still in the mainhand does.
# (If the player scrolled hotbar slots in the same tick, none matches and the
# click is dropped -- harmless.)
scoreboard players reset @s ir_click
execute if items entity @s weapon.mainhand *[minecraft:custom_data~{ir_spd:1}] run function infinite_rail:speed_inc
execute if items entity @s weapon.mainhand *[minecraft:custom_data~{ir_spd:-1}] run function infinite_rail:speed_dec
execute if items entity @s weapon.mainhand *[minecraft:custom_data~{ir_spd:0}] run function infinite_rail:speed_reset
