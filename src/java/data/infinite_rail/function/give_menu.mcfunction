# Pins the "Settings" book into the rider's LAST HOTBAR SLOT (hotbar.8) --
# the clickable mode menu. Select it and use (right-click) to open; each
# [On]/[Off] line is a click_event that runs the matching mode_* function,
# and [Current modes] prints the live toggle states to chat. Runs AS the
# player (main calls it for every adventure player right after the per-tick
# inventory clear, so the book is always there and nothing else ever
# accumulates; stop takes the book back).
#
# NOTES ON THE FORMAT (1.21.5+ text components, which the whole supported
# range 82-107 uses): pages are SNBT text components, click events are
# click_event:{action:"run_command",command:"..."} with NO leading slash,
# and the page root is an empty {text:""} so its style can't bleed into the
# children via inheritance.
#
# Book clicks run the command AS THE CLICKING PLAYER, with their permission
# level -- so the menu needs cheats (operator) to actually work, exactly
# like typing the mode commands in chat. Bedrock's menu is a native form
# driven by the script instead (no permission concern there).
item replace entity @s hotbar.8 with minecraft:written_book[written_book_content={title:"Settings",author:"Infinite Rail",pages:[{text:"",extra:[{text:"Infinite Rail\n",bold:true},{text:"ride settings\n\n",color:"gray"},{text:"Rain:  "},{text:"[On]",color:"dark_green",click_event:{action:"run_command",command:"function infinite_rail:mode_rain_on"}},{text:" "},{text:"[Off]",color:"dark_red",click_event:{action:"run_command",command:"function infinite_rail:mode_rain_off"}},{text:"\nNight:  "},{text:"[On]",color:"dark_green",click_event:{action:"run_command",command:"function infinite_rail:mode_night_on"}},{text:" "},{text:"[Off]",color:"dark_red",click_event:{action:"run_command",command:"function infinite_rail:mode_night_off"}},{text:"\nTorches:  "},{text:"[On]",color:"dark_green",click_event:{action:"run_command",command:"function infinite_rail:mode_torches_on"}},{text:" "},{text:"[Off]",color:"dark_red",click_event:{action:"run_command",command:"function infinite_rail:mode_torches_off"}},{text:"\nSky:  "},{text:"[On]",color:"dark_green",click_event:{action:"run_command",command:"function infinite_rail:mode_sky_on"}},{text:" "},{text:"[Off]",color:"dark_red",click_event:{action:"run_command",command:"function infinite_rail:mode_sky_off"}},{text:"\n\n"},{text:"[Current modes]",color:"dark_blue",click_event:{action:"run_command",command:"function infinite_rail:modes"}},{text:"\n\nClicks need cheats\n(operator).",color:"gray",italic:true}]}]}] 1
