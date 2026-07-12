# The QUARANTINED probe half of load's thunderstorm self-test (the decision
# half stays in load, the click-time warning in mode_storms_off): at any
# moment exactly one of the thundering / not_thundering predicate pair must
# match, so .stormok stays 0 only when the weather_check predicate is broken
# on this version -- or when this file itself failed to compile, and both
# mean the same thing for the warning: the No-Thunderstorms watcher cannot
# see storms (storm_watch runs the same command and is equally affected).
# Quarantined like check_clock: `execute if predicate` proved version-risky,
# and nothing version-risky may live in a critical file (see the standing
# rule in forceload_here's post-mortem).
execute if predicate infinite_rail:thundering run scoreboard players set .stormok ir 1
execute if predicate infinite_rail:not_thundering run scoreboard players set .stormok ir 1
