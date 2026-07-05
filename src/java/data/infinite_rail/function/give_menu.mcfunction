# Pins the "Settings" book into the rider's LAST HOTBAR SLOT (hotbar.8) --
# the clickable mode menu. Select it and use (right-click) to open; each
# [On]/[Off] line toggles the matching mode and [Current modes] prints the
# live toggle states to chat. Runs AS the player (main calls it for every
# adventure player right after the per-tick inventory clear, so the book is
# always there and nothing else ever accumulates; stop takes the book back).
#
# THE CLICKS GO THROUGH /trigger, NOT /function. Since 1.21.6, clicking a
# run_command link that needs elevated permissions (like /function) pops a
# confirmation screen on every single click -- even for operators. /trigger
# is runnable by every player at permission level 0, so each link just sets
# a number on the ir_menu trigger objective (created by load) and the
# menu_tick dispatcher turns it into the real mode call on the next tick.
# No confirmation screen, no operator requirement -- the menu works even
# for non-op players, matching Bedrock's native form.
#
# FORMAT NOTES (1.21.5+ text components, which the whole supported range
# 82-107 uses): pages are SNBT text components, click events are
# click_event:{action:"run_command",command:"..."} with NO leading slash,
# and the page root is an empty {text:""} so its style can't bleed into the
# children via inheritance.
item replace entity @s hotbar.8 with minecraft:written_book[written_book_content={title:"Settings",author:"Infinite Rail",pages:[{text:"",extra:[{text:"Infinite Rail\n",bold:true},{text:"ride settings\n\n",color:"gray"},{text:"Rain:  "},{text:"[On]",color:"dark_green",click_event:{action:"run_command",command:"trigger ir_menu set 1"}},{text:" "},{text:"[Off]",color:"dark_red",click_event:{action:"run_command",command:"trigger ir_menu set 2"}},{text:"\nNight:  "},{text:"[On]",color:"dark_green",click_event:{action:"run_command",command:"trigger ir_menu set 3"}},{text:" "},{text:"[Off]",color:"dark_red",click_event:{action:"run_command",command:"trigger ir_menu set 4"}},{text:"\nTorches:  "},{text:"[On]",color:"dark_green",click_event:{action:"run_command",command:"trigger ir_menu set 5"}},{text:" "},{text:"[Off]",color:"dark_red",click_event:{action:"run_command",command:"trigger ir_menu set 6"}},{text:"\nSky:  "},{text:"[On]",color:"dark_green",click_event:{action:"run_command",command:"trigger ir_menu set 7"}},{text:" "},{text:"[Off]",color:"dark_red",click_event:{action:"run_command",command:"trigger ir_menu set 8"}},{text:"\n\n"},{text:"[Current modes]",color:"dark_blue",click_event:{action:"run_command",command:"trigger ir_menu set 9"}}]}]}] 1
