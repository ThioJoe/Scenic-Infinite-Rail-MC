# Sets the minecart max-speed gamerule from storage infinite_rail:speed, which
# holds BOTH macro args: {rule:"<gamerule name>", v:<value>}. The gamerule name
# is version-dependent (minecartMaxSpeed on 1.21-era, max_minecart_speed on
# 26.x), and it is detected ONCE at load into `rule` by speed_name /
# speed_name_26 -- so this single macro line only ever runs the name that is
# valid on the running version. That matters: a macro line that expands to an
# unknown gamerule ABORTS the function (skipping anything after it), so we must
# never emit the wrong name here.
#
# Requires the world's "Minecart Improvements" feature for the rule to exist at
# all; without it this errors harmlessly and the ride stays at vanilla speed.
$gamerule $(rule) $(v)
