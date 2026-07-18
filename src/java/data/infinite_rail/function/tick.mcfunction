# Runs every game tick via #minecraft:tick.
# The menu books' (Ride/Visual Settings, Debug) click dispatcher (the /trigger relay -- see
# menu_tick), which also fans out the Speed items' ir_click stat.
function infinite_rail:menu_tick
# The Debug book's "Live state" sidebar: refresh the dbg mirror while that
# view is selected (.SIDEBAR 4 -- see sidebar_state / debug_tick).
execute if score .SIDEBAR ir matches 4 run function infinite_rail:debug_tick
# No-Thunderstorms mode (.STORMMODE 1 -- the Visual Settings book's
# "Storms: [Off]"): watch the natural weather and swap a starting
# thunderstorm for plain rain (storm_watch, quarantined -- predicates are
# version-risky). World state like rain mode, so it runs ride or no ride.
# Permanent rain stands the watcher down: its frozen cycle only ever rains,
# and the suppression is only meant for the natural cycle anyway.
execute if score .STORMMODE ir matches 1 unless score .RAINMODE ir matches 1 run function infinite_rail:storm_watch
# The world-rejoin unpark one-shot: load arms .rejchk on every (re)load --
# vanilla Java has no join event, and on a singleplayer world open the host
# player is already online when the load hook runs, so a rejoin cannot be
# told from a /reload (see load.mcfunction) -- and the first tick a player
# is targetable consumes it (rejoin_check -- a ride parked at speed 0
# resumes at the active cruise's default). Runs before main so a restored
# speed drives the pace cart the same tick.
execute if score .rejchk ir matches 1 if entity @a run function infinite_rail:rejoin_check
execute if score .started ir matches 1 run function infinite_rail:main
# .started 2 = a launch is in progress: begin seeded the ride and the runway
# is being pre-built a slice per tick (see launch_tick / launch_done).
execute if score .started ir matches 2 run function infinite_rail:launch_tick

# Auto-start: in a fresh world, begin the ride for the first player to appear
# -- no command needed.
# .autodone is set the first time a ride starts and is
# saved with the world, so /function infinite_rail:stop stays stopped (across
# rejoins too).
# Set .AUTOSTART to 0 in config.mcfunction to disable.

# Existing-world guard: the first tick a player is present in an armed,
# not-yet-started world (before the countdown begins), decide whether this is
# a FRESH world (let the countdown run) or one that has already been played
# (block + warn). One-shot -- once auto_gate either latches .autodone or the
# increment below advances .start_timer to 1, this stops firing. Skipped
# entirely when the guard is off (.WORLDAGEWARN 0). Runs BEFORE the increment
# so a latched .autodone this tick suppresses the countdown too. The countdown
# guard is `unless .start_timer matches 1..` (not `if matches 0`): on a world
# the pack was just added to, .start_timer is UNSET on the first player tick --
# which does NOT match `0`, but DOES satisfy `unless 1..` -- so the check still
# fires (an existing world the pack just joined is exactly what this catches).
execute if score .AUTOSTART ir matches 1 unless score .autodone ir matches 1 if score .WORLDAGEWARN ir matches 1.. unless score .start_timer ir matches 1.. if entity @a run function infinite_rail:auto_gate

# Wait until a player actually exists in the world, then count up 100 ticks (5 seconds) to let chunks load.
execute if score .AUTOSTART ir matches 1 unless score .autodone ir matches 1 if entity @a run scoreboard players add .start_timer ir 1
# The tick the countdown begins, start force-generating the landing pad at
# the western start line (X -99000 -- see auto_prep: maximizes the ride's
# time at low absolute coordinates, where Bedrock's 32-bit float positions
# are precise; Java mirrors it for parity). The player is NOT moved yet --
# the countdown is the pad's chunk-loading time, and the teleport happens
# at the very end (auto_place, below), straight into begin's same-tick
# seat lift. That is what the countdown was always for; it just loads the
# destination now instead of the spawn.
execute if score .start_timer ir matches 1 unless score .autodone ir matches 1 run function infinite_rail:auto_prep
execute if score .start_timer ir matches 1 unless score .autodone ir matches 1 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Starting in 5...","color":"yellow"}]
execute if score .start_timer ir matches 20 unless score .autodone ir matches 1 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Starting in 4...","color":"yellow"}]
execute if score .start_timer ir matches 40 unless score .autodone ir matches 1 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Starting in 3...","color":"yellow"}]
execute if score .start_timer ir matches 60 unless score .autodone ir matches 1 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Starting in 2...","color":"yellow"}]
execute if score .start_timer ir matches 80 unless score .autodone ir matches 1 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Starting in 1...","color":"yellow"}]
# At 100+ ticks: teleport the starter to the pad and start, in the SAME
# tick -- HELD until the landing pad is actually generated (begin's surface
# probe is synchronous and must land on real terrain). .relok is preset 1
# and the quarantined auto_ready only ever LOWERS it (fail-open: if `if
# loaded` breaks on some version, this fires at 100 ticks like before the
# relocation existed). Retries every tick; a one-shot note at 300 (10 s of
# holding) says what the wait is. auto_place immediately followed by start
# is what makes the arrival seamless: begin captures the player's new
# position and its launch lift seats them on the rail line before the
# client renders a single mid-air frame.
execute if score .start_timer ir matches 100.. unless score .autodone ir matches 1 run scoreboard players set .relok ir 1
execute if score .start_timer ir matches 100.. unless score .autodone ir matches 1 run function infinite_rail:auto_ready
execute if score .start_timer ir matches 300 unless score .autodone ir matches 1 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Still generating the starting terrain...","color":"yellow"}]
execute if score .start_timer ir matches 100.. unless score .autodone ir matches 1 if score .relok ir matches 1 as @p run function infinite_rail:auto_place
execute if score .start_timer ir matches 100.. unless score .autodone ir matches 1 if score .relok ir matches 1 run function infinite_rail:start