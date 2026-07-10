# One re-trigger of the minecart riding sound (mode_sound_* / .SOUNDMODE).
# main's clock calls this every 115 ticks -- the length of the vanilla
# entity.minecart.inside sample (minecart/inside.ogg, 5.77 s = 115.4 ticks)
# -- so each played copy starts just as the previous one ends: a continuous
# loop out of a sound the datapack cannot itself loop.
#
# SINGLE INSTANCE, NEVER CUMULATIVE. The 115-tick trigger period is fixed
# (a scoreboard counter, independent of the audio), and each /playsound
# self-terminates after 115.4 ticks, so even on its own the overlap is
# bounded to the 0.4-tick seam (at most two copies at once) and cannot
# grow. The stopsound below removes even that: it kills the copy still
# playing (its last ~0.4 tick) an instant before the new one starts, so
# EXACTLY ONE instance ever exists -- the seam can never accumulate into a
# stack of phasing copies no matter how long the ride runs, and a /reload
# or a lag spike mid-sample can't leave a stray copy behind. stopsound
# only affects this sound id, and only the rider ever has it playing.
#
# WHY IT SOUNDS RIGHT (the earlier version faded and gapped): a /playsound
# is emitted at a FIXED world point, and the ride glides away from it -- up
# to ~185 blocks over one 5.77 s copy on an ocean sprint. The fix is the
# VOLUME argument. On Java, a volume above 1.0 does NOT make the sound
# louder; it only extends the distance it carries (the listener's perceived
# loudness is still capped at full). At 100 the audible radius is enormous,
# so the rider sits deep in the flat-volume zone for the whole copy no
# matter how far they travel -- constant volume, no fade. Only the rider is
# a target (@s), so the large volume is never heard by anyone else.
#
# entity.minecart.inside is the FIRST-PERSON riding sample (what you hear
# sitting IN a cart), the one the ride wants -- reachable here because
# /playsound takes any registered sound event by name, with no cart needed.
# It is unattached (unlike the engine's in-cart loop, which the smoothed,
# velocity-zeroed rig can never trigger), so the ride cart stays silent and
# this stands in for it.
# The clock only resets when the playsound actually REACHED a rider: while
# the rider is still joining (world load resumes a ride before their player
# entity exists) the selector matches nobody, and unconditionally zeroing
# .sndt here used to swallow the whole cycle -- the ride stayed mute for up
# to 5.75 s after loading in. With the store-success guard, main's clock
# stays at the threshold and this file simply retries every tick until the
# rider is targetable, so the sound starts the moment they are.
stopsound @a[tag=ir_rider] neutral minecraft:entity.minecart.inside
execute store success score .sndok ir as @a[tag=ir_rider] at @s run playsound minecraft:entity.minecart.inside neutral @s ~ ~ ~ 100 1
execute if score .sndok ir matches 1 run scoreboard players set .sndt ir 0
