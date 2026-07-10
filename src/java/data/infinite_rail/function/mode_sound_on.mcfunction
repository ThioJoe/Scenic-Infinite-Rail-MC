# Mode toggle:  /function infinite_rail:mode_sound_on
# Turn the minecart sound on. The ride cart glides OFF the rails (it is a
# passenger of the camera seat, and the client zeroes every passenger's
# velocity each tick), so it never triggers the engine's own in-cart sound
# loop -- and the pace cart that DOES roll is (.PACE_CART_BEHIND - .RIDER_BEHIND) (~64) blocks behind,
# past the vanilla 16-block earshot. So the sound is faked: main re-triggers
# the vanilla first-person riding sample (entity.minecart.inside) at the
# rider every 115 ticks -- the sample's own length -- for a continuous loop,
# at a large volume so it never fades as the ride moves (see sound_loop).
# Priming the clock at its firing threshold starts the sound immediately.
# State like every mode (.SOUNDMODE persists across /reload, ride restarts
# and rejoins); config .CARTSOUND is only its first-load default.
scoreboard players set .SOUNDMODE ir 1
scoreboard players set .sndt ir 115
tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Minecart sound on.","color":"gray"}]
