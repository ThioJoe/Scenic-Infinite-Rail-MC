# The No-Thunderstorms watcher: tick calls this (only) while .STORMMODE is 1
# and permanent rain is off -- see the guard line in tick.mcfunction. The
# moment the natural cycle rolls a thunderstorm, re-roll it as plain rain;
# with no duration given, vanilla picks its usual random rain duration, so
# the weather keeps cycling naturally (the sky just never thunders). The
# predicate reads the same weather state that renders the sky, so a /weather
# thunder from chat converts exactly like a natural storm. NOT instant, by
# vanilla's design: the thunder LEVEL ramps ~0.01/tick and weather_check
# only reads true once it crosses the threshold (~100 ticks / ~5 s in,
# measured on 26.2) -- i.e. the storm is re-rolled right as the thunder
# becomes real, which is also the first moment a command can see it.
#
# QUARANTINED in its own file because `execute if predicate` is
# version-risky (26.2 refused to compile it inside load.mcfunction -- see
# check_clock's post-mortem): if this file fails to compile, tick's function
# CALL fails softly and only this feature degrades. A missing/unparsed
# predicate file evaluates as false = never thundering -- the same soft
# failure; load's storm_check self-test catches both, and mode_storms_off
# warns the player who actually turns the feature on.
execute if predicate infinite_rail:thundering run weather rain
