# The QUARANTINED probe half of load's day/night self-test (the decision
# half stays in load): sets .todok to 1 when either the night or the day
# predicate matches -- at any moment exactly one of the pair should.
#
# Quarantined like time_now because `execute if predicate` itself proved
# version-risky: 26.2 refused to compile it inside load.mcfunction, which
# killed the ENTIRE bootstrap -- no objectives, no config, no auto-start.
# The standing rule (see forceload_here's post-mortem): nothing
# version-risky may live in a critical file, because a failed line takes
# the whole file with it at load, while a `function` CALL to a broken file
# just fails softly at runtime. load presets .todok to 0 and calls this
# file; .todok stays 0 either when both predicates read false or when this
# file itself failed to load -- and both mean the same thing for the
# warning: torch auto cannot tell day from night on this version (time_now
# runs the same command and is equally affected).
execute if predicate infinite_rail:night run scoreboard players set .todok ir 1
execute if predicate infinite_rail:day run scoreboard players set .todok ir 1
