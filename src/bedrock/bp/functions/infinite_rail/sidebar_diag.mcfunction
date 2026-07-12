# Debug menu: show the LIVE RIG & TICK DIAGNOSTICS on the scoreboard sidebar
# -- the display-only `dbg_live` objective, refreshed every tick by the
# script while this view is selected (that's what .SIDEBAR 5 gates).
# Bedrock-only: the rows are Script API measurements (seat drift from its
# glide target, the rider's astray distance/streak, player + seat velocity,
# pace speed vs target vs the buffer's ceiling, tick lull/cost, the
# builder's starve streak) that Java has no equivalent for. See
# tickDiagSidebar in scripts/main.js for each row's meaning and scale.
scoreboard objectives setdisplay sidebar dbg_live
scoreboard players set .SIDEBAR ir 5
tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Sidebar: live rig & tick diagnostics (refreshed every tick)."}]}
