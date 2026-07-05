# Sets an arbitrary gamerule from storage infinite_rail:rule, which holds BOTH
# macro args: {rule:"<gamerule name>", v:"<value>"}. The generic sibling of
# set_speed (same trick, its own storage): gamerule NAMES differ by version
# (camelCase on data-pack formats 82-91, snake_case on 92+), and a macro line
# that expands to an unknown gamerule ABORTS its whole function -- so callers
# must never hard-code a name here. Instead they copy `rule` from storage
# infinite_rail:names, which the version-selected names.mcfunction (base vs
# overlay_snake) filled with the correct spelling at load, and set `v` to the
# value ("true"/"false") just before the call.
# Used by the rain and night mode toggles (mode_rain_on/off, mode_night_on/off).
$gamerule $(rule) $(v)
