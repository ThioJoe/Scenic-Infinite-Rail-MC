# Pins the rider's hotbar items -- runs AS the player (main calls it for
# every adventure player right after the per-tick inventory clear, so the
# items are always there and nothing else ever accumulates; stop takes them
# back):
#   hotbar.0  "Speed -"   one block/s slower   (re-modeled carrot_on_a_stick)
#   hotbar.1  "Speed +"   one block/s faster   (re-modeled carrot_on_a_stick)
#   hotbar.7  "Debug"     debug book: chat diagnostics + sidebar views
#   hotbar.8  "Settings"  settings book: the ride-mode menu (the classic)
#
# THE BOOK CLICKS GO THROUGH /trigger, NOT /function. Since 1.21.6, clicking
# a run_command link that needs elevated permissions (like /function) pops a
# confirmation screen on every single click -- even for operators. /trigger
# is runnable by every player at permission level 0, so each link just sets
# a number on the ir_menu trigger objective (created by load) and the
# menu_tick dispatcher turns it into the real call on the next tick. No
# confirmation screen, no operator requirement -- the menu works even for
# non-op players, matching Bedrock's native form. (The number map lives in
# menu_tick's header.)
#
# THE SPEED ITEMS are carrot_on_a_sticks -- the one item whose "used"
# statistic increments on any right-click (the ir_click objective; see
# speed_click) -- re-skinned via the minecraft:item_model component (a dye /
# an emerald) and told apart by custom_data. One click = one block/s.
#
# FORMAT NOTES (1.21.5+ text components, which the whole supported range
# 82-107 uses): pages are SNBT text components, click events are
# click_event:{action:"run_command",command:"..."} with NO leading slash,
# hover tips are hover_event:{action:"show_text",value:"..."}, and each
# page root is an empty {text:""} so its style can't bleed into the
# children via inheritance.
item replace entity @s hotbar.0 with minecraft:carrot_on_a_stick[minecraft:item_model="minecraft:red_dye",minecraft:item_name="Speed -",minecraft:custom_data={ir_spd:-1},minecraft:lore=["One block/s slower"]] 1
item replace entity @s hotbar.1 with minecraft:carrot_on_a_stick[minecraft:item_model="minecraft:emerald",minecraft:item_name="Speed +",minecraft:custom_data={ir_spd:1},minecraft:lore=["One block/s faster"]] 1
item replace entity @s hotbar.7 with minecraft:written_book[written_book_content={title:"Debug",author:"Infinite Rail",pages:[{text:"",extra:[{text:"Infinite Rail\n",bold:true},{text:"debug tools\n\n",color:"gray"},{text:"Chat output:  "},{text:"[On]",color:"dark_green",click_event:{action:"run_command",command:"trigger ir_menu set 14"},hover_event:{action:"show_text",value:"Print speed-system diagnostics in chat (ocean/land chunks, speed changes)"}},{text:" "},{text:"[Off]",color:"dark_red",click_event:{action:"run_command",command:"trigger ir_menu set 15"}},{text:"\n\nSidebar:\n"},{text:"[Terrain]",color:"dark_green",click_event:{action:"run_command",command:"trigger ir_menu set 16"},hover_event:{action:"show_text",value:"Show the cfg_terrain settings group.\nTweak live: /scoreboard players set .HOVER cfg_terrain 8"}},{text:" "},{text:"[Camera]",color:"dark_green",click_event:{action:"run_command",command:"trigger ir_menu set 17"},hover_event:{action:"show_text",value:"Show the cfg_camera settings group.\nTweak live: /scoreboard players set .CAMLIFT cfg_camera 25"}},{text:"\n"},{text:"[Ride]",color:"dark_green",click_event:{action:"run_command",command:"trigger ir_menu set 18"},hover_event:{action:"show_text",value:"Show the cfg_ride settings group (speed, mode knobs, performance).\nTweak live: /scoreboard players set .OCEANSPEED cfg_ride 32"}},{text:" "},{text:"[Live state]",color:"dark_green",click_event:{action:"run_command",command:"trigger ir_menu set 19"},hover_event:{action:"show_text",value:"The algorithm's live values, refreshed every tick: rail/target/avg elevation, slope + gap state, the near-ground scan, speed"}},{text:"\n"},{text:"[Hide]",color:"dark_red",click_event:{action:"run_command",command:"trigger ir_menu set 20"},hover_event:{action:"show_text",value:"Clear the sidebar"}},{text:"\n\n"},{text:"[Command help]",color:"dark_blue",click_event:{action:"run_command",command:"trigger ir_menu set 21"},hover_event:{action:"show_text",value:"Print /scoreboard example commands to chat (click one there to prefill it)"}}]}]}] 1
item replace entity @s hotbar.8 with minecraft:written_book[written_book_content={title:"Settings",author:"Infinite Rail",pages:[{text:"",extra:[{text:"Infinite Rail\n",bold:true},{text:"ride settings\n\n",color:"gray"},{text:"Rain:  "},{text:"[On]",color:"dark_green",click_event:{action:"run_command",command:"trigger ir_menu set 1"}},{text:" "},{text:"[Off]",color:"dark_red",click_event:{action:"run_command",command:"trigger ir_menu set 2"}},{text:"\nTime:  "},{text:"[Night]",color:"dark_purple",click_event:{action:"run_command",command:"trigger ir_menu set 3"},hover_event:{action:"show_text",value:"Night only - frozen at midnight"}},{text:" "},{text:"[Day]",color:"gold",click_event:{action:"run_command",command:"trigger ir_menu set 10"},hover_event:{action:"show_text",value:"Day only - frozen at noon"}},{text:" "},{text:"[Default]",color:"dark_red",click_event:{action:"run_command",command:"trigger ir_menu set 4"},hover_event:{action:"show_text",value:"Normal day/night cycle"}},{text:"\nTorches:  "},{text:"[On]",color:"dark_green",click_event:{action:"run_command",command:"trigger ir_menu set 5"}},{text:" "},{text:"[Off]",color:"dark_red",click_event:{action:"run_command",command:"trigger ir_menu set 6"}},{text:"\nSky:  "},{text:"[On]",color:"dark_green",click_event:{action:"run_command",command:"trigger ir_menu set 7"}},{text:" "},{text:"[Off]",color:"dark_red",click_event:{action:"run_command",command:"trigger ir_menu set 8"}},{text:"\nSpeed:  "},{text:"[-]",color:"dark_red",click_event:{action:"run_command",command:"trigger ir_menu set 11"},hover_event:{action:"show_text",value:"One block/s slower (also the Speed - hotbar item)"}},{text:" "},{text:"[+]",color:"dark_green",click_event:{action:"run_command",command:"trigger ir_menu set 12"},hover_event:{action:"show_text",value:"One block/s faster (also the Speed + hotbar item)"}},{text:" "},{text:"[Reset]",color:"dark_blue",click_event:{action:"run_command",command:"trigger ir_menu set 13"},hover_event:{action:"show_text",value:"Back to the config default (.MAXSPEED) - the chat message shows the number"}},{text:"\n\n"},{text:"[Current modes]",color:"dark_blue",click_event:{action:"run_command",command:"trigger ir_menu set 9"}}]}]}] 1
