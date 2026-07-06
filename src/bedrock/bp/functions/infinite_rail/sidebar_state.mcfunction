# Debug menu: show the LIVE ride state on the scoreboard sidebar -- the
# display-only `dbg` objective, a curated 15-row mirror of the algorithm's
# runtime scores (rail/target/avg elevation, slope + gap state, the
# near-ground scan, speed), refreshed every tick by the script while this
# view is selected (that's what .SIDEBAR 4 gates).
scoreboard objectives setdisplay sidebar dbg
scoreboard players set .SIDEBAR ir 4
tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Sidebar: live ride state (refreshed every tick)."}]}
