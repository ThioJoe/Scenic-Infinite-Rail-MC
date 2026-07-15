# Auto-start's terrain-readiness probe, run every tick the countdown sits
# at 100+ (tick.mcfunction): begin is SYNCHRONOUS -- its surface probe must
# land on generated terrain the same tick -- and the countdown's player was
# just relocated ~99k blocks west into brand-new chunks (auto_relocate), so
# the start is held until the chunk under the player is actually loaded.
# Quarantined in its own file like time_now/check_clock/auto_gate:
# `execute if/unless loaded` is a newer subcommand (1.20.5+), and a command
# that fails to compile kills its whole file -- kept alone, a hypothetical
# failure only costs this probe, and the FAIL-OPEN wiring in tick (.relok
# preset to 1; this file only ever LOWERS it) degrades to firing at 100
# ticks exactly as the pre-relocation pack did.
execute as @p at @s unless loaded ~ ~ ~ run scoreboard players set .relok ir 0
