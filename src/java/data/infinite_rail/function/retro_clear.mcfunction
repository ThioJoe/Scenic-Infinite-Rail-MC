# A slope just started (the shared start_event raised #retro): retroactively
# clear the FULL center bore over the last #SLOPECLEAR columns -- the camera
# lifts off the rail line before the slope arrives, so vegetation spared over
# those (flat, same-elevation) columns must go after all. Vertical only: the
# cells left and right of the track keep their plants.
#
# Runs positioned at the head, which still sits on the LAST BUILT column
# (advance moves it after decide). The span is clamped to the columns this
# ride actually built, so the fill can never reach behind the start point.
scoreboard players operation #rk ir = #SLOPECLEAR ir
scoreboard players operation #rt ir = #headX ir
scoreboard players operation #rt ir -= #trackBase ir
scoreboard players operation #rk ir < #rt ir
execute store result storage infinite_rail:carve k int 1 run scoreboard players get #rk ir
execute store result storage infinite_rail:carve h int 1 run scoreboard players get #TUNNEL ir
function infinite_rail:retro_fill with storage infinite_rail:carve
