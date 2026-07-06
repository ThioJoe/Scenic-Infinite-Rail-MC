# The Debug menu's "Live state" sidebar view: mirrors the shared brain's
# runtime scores (present in `ir` on BOTH editions) into the display-only
# `dbg` objective. A vanilla sidebar shows exactly one objective (max 15
# rows) and `ir` holds ~100 internal scores, so a curated mirror is the only
# way to watch the interesting ones live.
#
# Called once per tick WHILE the Live state view is selected (.SIDEBAR 4):
# from tick.mcfunction's debug_tick on Java, from the script ticker on
# Bedrock. Each edition then adds its native values (.headX, .gap, .avg,
# .fast, .started -- engine-side state that isn't in `ir` on Bedrock) beside
# these ten, for 15 rows total -- the sidebar maximum.
scoreboard players operation .railY dbg = .railY ir
scoreboard players operation .target dbg = .target ir
scoreboard players operation .diff dbg = .diff ir
scoreboard players operation .slope dbg = .slope ir
scoreboard players operation .flat dbg = .flat ir
scoreboard players operation .dir dbg = .dir ir
scoreboard players operation .gfloor dbg = .gfloor ir
scoreboard players operation .gmax dbg = .gmax ir
scoreboard players operation .gcone dbg = .gcone ir
scoreboard players operation .speed dbg = .speed ir
