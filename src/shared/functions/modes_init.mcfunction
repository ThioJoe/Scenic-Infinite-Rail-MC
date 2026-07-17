# Seeds the ride-mode toggle scores WITHOUT touching a mode that is already
# set: "add 0" creates a missing score and leaves an existing one alone
# (the two non-zero defaults -- .TORCHMODE and .SOUNDMODE -- use a one-shot
# companion flag instead, below). Modes are STATE, not config -- they are
# flipped by the mode_* functions, survive /reload (config.mcfunction
# re-runs on every reload and would reset them if they lived there), and
# persist in the world save like every other ir score.
# Called once per load: from load.mcfunction on Java, from the script's
# init() on Bedrock.
# .NIGHTMODE is a TRI-STATE: 0 = default day/night cycle, 1 = night only
# (frozen midnight), 2 = day only (frozen noon).
scoreboard players add .RAINMODE ir 0
scoreboard players add .NIGHTMODE ir 0
scoreboard players add .SKYMODE ir 0
# .TORCHMODE is a TRI-STATE with a NON-ZERO default: 0 = off, 1 = always
# on, 2 = auto (torches only while it is night -- the shared torch_auto
# answers per column). Add-0 seeding can't produce a 2, so it gets the same
# one-shot companion-flag treatment as .SOUNDMODE below (.trchinit): the
# default is written only on the load that first creates the flag, then a
# menu/command choice owns the score forever after. The extra
# .TORCHMODE-is-0 condition is for worlds UPGRADING from the on/off era: a
# deliberately switched-on 1 stays on; only off/never-set becomes auto.
scoreboard players add .TORCHMODE ir 0
scoreboard players add .trchinit ir 0
execute if score .trchinit ir matches 0 if score .TORCHMODE ir matches 0 run scoreboard players set .TORCHMODE ir 2
execute if score .trchinit ir matches 0 run scoreboard players set .trchinit ir 1
# .HIDECART: 1 = the visible minecart is removed and the rider floats on the
# invisible seat alone (Java re-seats the rider onto the seat itself;
# Bedrock just stops spawning the scenery cart prop).
scoreboard players add .HIDECART ir 0
# .HIDETRACK: 1 = invisible track -- columns built from now on get NO visible
# rail/support (carve, light, torches and the movement are unchanged; track
# built before the toggle keeps its rails). Bedrock simply skips the two
# placements (nothing rides its physical track); Java still needs rails
# under the hidden pace cart, so a short just-in-time strip is kept rolling
# beneath it, out of the rider's view (invis_tick & co. -- see CONTEXT 6.9).
scoreboard players add .HIDETRACK ir 0

# The minecart-sound toggle (.SOUNDMODE -- each edition's clock re-triggers
# the vanilla rolling sound at the rider while it is 1) is a mode like the
# ones above, but with a config-side DEFAULT (.CARTSOUND) instead of a fixed
# 0 -- so it can't use plain add-0 seeding: for a 0/1 toggle, "never set"
# and "off" are the same number. A one-shot companion flag (.sndinit) tells
# them apart: the default is copied only on the load that first creates the
# flag, then never again, so a menu choice survives /reload, ride restarts
# and rejoins exactly like every other mode.
scoreboard players add .sndinit ir 0
execute if score .sndinit ir matches 0 run scoreboard players operation .SOUNDMODE ir = .CARTSOUND cfg_ride
execute if score .sndinit ir matches 0 run scoreboard players set .sndinit ir 1

# Mobs aggro (.AGGROMODE): 1 = hostile mobs can see the rider and react --
# creepers sneak up and hiss, skeletons draw their bows -- the vanilla
# ambience; 0 = an invisibility effect on the rider makes mobs ignore the
# ride (on Bedrock invisible players are completely undetectable; the same
# effect is also what hides the Bedrock first-person arm, the job of the
# retired .HIDEHAND knob). The effect itself is applied natively per edition
# (Java mode_aggro_*/launch_done, Bedrock's keeper). Like .SOUNDMODE it has a
# config-side DEFAULT (.MOBAGGRO) instead of a fixed value -- so it can't use
# plain add-0 seeding either (for a 0/1 toggle "never set" and "off" are the
# same number): the one-shot companion flag .agginit copies the default in
# only on the load that first creates the flag, then a menu/command choice
# owns the score forever after.
scoreboard players add .AGGROMODE ir 0
scoreboard players add .agginit ir 0
execute if score .agginit ir matches 0 run scoreboard players operation .AGGROMODE ir = .MOBAGGRO cfg_ride
execute if score .agginit ir matches 0 run scoreboard players set .agginit ir 1

# No thunderstorms (.STORMMODE): 1 = a natural thunderstorm is switched to
# plain rain the moment it starts (Java: the tick hook runs the quarantined
# storm_watch; Bedrock: the script's weatherChange watch); 0 = vanilla
# storms (the default). Toggled by mode_storms_on / mode_storms_off -- named
# for the user-facing question "storms on or off?", so storms_OFF is what
# SETS this score. Like .SOUNDMODE it has a config-side DEFAULT (.NOSTORMS)
# instead of a fixed value, so plain add-0 seeding can't tell "never set"
# from "off": the one-shot companion flag .stminit copies the default in
# only on the load that first creates the flag, then a menu/command choice
# owns the score forever after.
scoreboard players add .STORMMODE ir 0
scoreboard players add .stminit ir 0
execute if score .stminit ir matches 0 run scoreboard players operation .STORMMODE ir = .NOSTORMS ir
execute if score .stminit ir matches 0 run scoreboard players set .stminit ir 1

# The three adjustable cruise speeds (.speed land / .skyspd sky / .ocnspd
# ocean -- see the shared speed_step) are state like the modes: each is
# seeded from its config default ONCE, so a speed chosen with the Speed +/-
# items survives /reload, ride restarts and rejoins. Since stop-and-reverse,
# 0 (parked) and negative (backwards) are LEGAL values -- so "never set" can
# no longer be told from "deliberately 0" by the value alone, and the seeds
# sit behind a one-shot companion flag (.spdinit, the .sndinit pattern): on
# the load that first creates the flag, any <= 0 value is (re)seeded from
# its default -- exactly the old rule, so upgrading worlds keep their chosen
# speeds -- and afterwards the scores are never touched again, so a ride
# parked at 0 or backing up at -8 stays that way across a /reload. (A new
# RIDE still normalizes: begin treats a <= 0 land speed as the config
# default, so a fresh start always launches forward.)
# (.ocnspd is only a sane starting value either way: on each ocean ENTRY
# speed_up RECOMPUTES it raise-only -- max(.OCEANSPEED, .speed) -- so the
# ocean never SLOWS a rider already going faster than the ocean speed. The
# Speed items still tune it in BOTH directions mid-sprint; the next entry
# recomputes. With the ocean speed-up disabled in config -- .OCEANSPEED 0 --
# it seeds 0 and the entry recompute covers a later enable.)
scoreboard players add .speed ir 0
scoreboard players add .skyspd ir 0
scoreboard players add .ocnspd ir 0
scoreboard players add .spdinit ir 0
execute if score .spdinit ir matches 0 if score .speed ir matches ..0 run scoreboard players operation .speed ir = .DEFAULTSPEED cfg_ride
execute if score .spdinit ir matches 0 if score .skyspd ir matches ..0 run scoreboard players operation .skyspd ir = .SKYSPEED cfg_ride
execute if score .spdinit ir matches 0 if score .ocnspd ir matches ..0 run scoreboard players operation .ocnspd ir = .OCEANSPEED cfg_ride
execute if score .spdinit ir matches 0 run scoreboard players set .spdinit ir 1

# Track light (.LIGHTMODE): the light level of the invisible light block
# placed 3 above every NEW rail (0 = none -- dark tunnels and nights; the
# menu presets are Off 0 / Low 8 / On 11). A non-zero default (11, the
# classic bright line), so it seeds with a one-shot flag like .AGGROMODE.
scoreboard players add .LIGHTMODE ir 0
scoreboard players add .lgtinit ir 0
execute if score .lgtinit ir matches 0 run scoreboard players set .LIGHTMODE ir 11
execute if score .lgtinit ir matches 0 run scoreboard players set .lgtinit ir 1

# Torch density (.torchdens -- the roll place_torch/maybeTorch actually
# uses) follows the same pattern: seeded from the config default .TORCHODDS
# only when never set, then owned by the Visual Settings menu's presets (the
# torch_density_* functions: Low 15 / Medium 35 / High 70 / Max 100), so a
# chosen density survives /reload, ride restarts and rejoins.
scoreboard players add .torchdens ir 0
execute if score .torchdens ir matches ..0 run scoreboard players operation .torchdens ir = .TORCHODDS cfg_ride
