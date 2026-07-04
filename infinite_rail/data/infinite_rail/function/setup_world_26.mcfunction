# One-time world tuning -- 26.x-era twin of setup_world.mcfunction.
#
# Snapshot 25w44a renamed every gamerule to snake_case (and reworked a few),
# so this file only compiles on those versions; on 1.21-era versions it fails
# to compile and is silently skipped while the camelCase setup_world runs
# instead. begin calls both. Keep the two files in sync when changing a rule.
gamerule send_command_feedback false
gamerule command_block_output false
gamerule log_admin_commands false
# announceAdvancements was renamed to show_advancement_messages.
gamerule show_advancement_messages false
# spawnChunkRadius no longer exists as a gamerule in 26.x; the rolling
# setworldspawn keeps spawn chunks near the ride anyway, so nothing anchors
# to the origin.
# Creepers/endermen must never damage the track.
gamerule mob_griefing false
# doFireTick was removed; fire now only spreads within this radius of a
# player. 0 = no fire ever creeps onto the line.
gamerule fire_spread_radius_around_player 0
# doInsomnia became spawn_phantoms.
gamerule spawn_phantoms false
# Disable all environmental damage to ensure true invulnerability (no damage sounds or fire screen).
gamerule fall_damage false
gamerule fire_damage false
gamerule freeze_damage false
gamerule drown_damage false
# If something impossible happens, come straight back (spawnpoint follows the ride).
gamerule immediate_respawn true
