# The lazy fill's score half (see surf_roll): a walk read a "never probed"
# cache slot, so probe the surface there for real -- ONCE, for every later
# column -- and cache it. Input: .suo = the walk's offset east of the head
# (cache index = offset - 1). Output: .s = the probed height (or its void
# answer, <= -63, which the macro half leaves uncached so it is retried).
# Must run positioned at the head marker, like the walks that call it (the
# macro's probe offset is relative).
scoreboard players operation .sui ir = .suo ir
scoreboard players remove .sui ir 1
execute store result storage infinite_rail:surfa o int 1 run scoreboard players get .suo ir
execute store result storage infinite_rail:surfa i int 1 run scoreboard players get .sui ir
function infinite_rail:surf_fill with storage infinite_rail:surfa
