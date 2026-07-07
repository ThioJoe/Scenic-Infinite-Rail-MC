# Mode toggle:  /function infinite_rail/mode_sound_on
# Turn the minecart riding sound on. Nothing on Bedrock rolls on rails (the
# pace is virtual, the cart prop is scripted scenery), so scripts/main.js
# plays the vanilla first-person riding sample at the rider -- ONCE: the
# vanilla file carries a baked-in FMOD loop flag, so a single play loops
# forever (tickSound() just re-anchors it near the rider every 256 blocks
# and stops it when the mode/ride ends). The sound id is the RP's OWN
# definition (ir.cart_roll: vanilla's sounds/minecart/inside file with
# min_distance 512 = no distance attenuation, so the loop holds constant
# volume as the ride glides; the global minecart.base EVENT stays silenced
# by the pack's phantom-noise fixes). State like every mode (.SOUNDMODE
# persists); config .CARTSOUND is only its first-load default.
scoreboard players set .SOUNDMODE ir 1
tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Minecart sound on."}]}
