# The active climb/descent has reached the target elevation: return to flat
# and start counting the gap before the next event may begin. #dir stays 0, so
# this column is placed as a flat rail at the elevation just reached.
scoreboard players set #slope ir 0
scoreboard players set #flat ir 0
