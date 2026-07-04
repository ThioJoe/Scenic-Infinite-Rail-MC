# Sets the minecart max-speed gamerule from storage infinite_rail:speed, which
# holds BOTH macro args: {rule:"<gamerule name>", v:<value>}. The gamerule name
# is version-dependent (minecartMaxSpeed on formats 82-91, max_minecart_speed on
# 92+), and it is set ONCE at load into `rule` by the version-selected
# names.mcfunction (see pack.mcmeta overlays) -- so this single macro line only
# ever runs the name valid on the running version. That matters: a macro line
# that expands to an unknown gamerule ABORTS the function (skipping anything
# after it), so we must never emit the wrong name here. `v` is set by the caller
# (begin/speed_up/speed_down) just before the call.
#
# The minecart_improvements feature is enabled in pack.mcmeta, so the rule
# always exists while this pack is loaded.
$gamerule $(rule) $(v)
