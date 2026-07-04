# Sets the minecart max-speed gamerule from a score. Gamerule values can't be
# scoreboard references, so the value arrives as the macro arg $(v) (stored into
# infinite_rail:speed v by the caller).
#
# VERSION NOTE: this rule is named "minecartMaxSpeed" on 1.21-era versions;
# snapshot 25w44a (the 26.x era) renamed the gamerules to snake_case, making it
# "max_minecart_speed". BOTH spellings are set below -- on any given version one
# of them is a valid gamerule and takes effect, and the other is an unknown-rule
# no-op (setting a gamerule that doesn't exist does nothing).
#
# This also requires the "Minecart Improvements" feature to be enabled for the
# rule to exist at all; on worlds without it, both lines are no-ops and the ride
# runs at vanilla speed.
$gamerule minecartMaxSpeed $(v)
$gamerule max_minecart_speed $(v)
