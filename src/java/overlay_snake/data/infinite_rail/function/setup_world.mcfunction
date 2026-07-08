# One-time world tuning -- 26.x snake_case copy of setup_world.
#
# This overlay file (overlay_snake/, applied on data-pack format 92+ via
# pack.mcmeta) REPLACES the base data/.../setup_world.mcfunction on 26.x-era
# versions. Snapshot 25w44a renamed every gamerule to snake_case (and reworked a
# few), so the base camelCase file would fail to compile here; the overlay
# supplies these names instead. begin calls setup_world once -- whichever copy is
# active for the running version runs. Keep the two copies in sync.
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
# Prevent blocks broken by the track builder (like unsupported torches) from
# dropping items. doTileDrops' snake_case name is block_drops (verified against
# the 26.2 command registry -- there was never a do_tile_drops).
gamerule block_drops false
# Disable all environmental damage to ensure true invulnerability (no damage sounds or fire screen).
gamerule fall_damage false
gamerule fire_damage false
gamerule freeze_damage false
gamerule drowning_damage false
# If something impossible happens, come straight back (spawnpoint follows the ride).
gamerule immediate_respawn true
