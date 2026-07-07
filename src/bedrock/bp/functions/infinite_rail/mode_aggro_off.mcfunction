# Mode toggle:  /function infinite_rail/mode_aggro_off
# Mobs ignore the ride: the script's keeper puts an invisibility effect on
# the rider (re-asserted once a second -- scripts/main.js), and on Bedrock
# invisible players are completely undetectable by mobs, so the ride glides
# through the night unbothered -- no bow-draws, no hisses, no chases. The
# scenery mobs still spawn and wander; they just pay the rider no
# attention. Bonus: the invisibility also hides the first-person arm (the
# retired .HIDEHAND knob's old job) and the rider's body in third-person.
scoreboard players set .AGGROMODE ir 0
tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Mobs aggro OFF - mobs will ignore the ride (this also hides your first-person arm)."}]}
