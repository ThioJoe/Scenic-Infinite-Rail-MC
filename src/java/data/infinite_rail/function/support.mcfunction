# Places the hidden power block for one column: a block of redstone directly
# under the rail (~-1). A redstone block powers the powered rail resting on it,
# is immune to water, and emits no light -- so it can't be washed away and can't
# melt ice. That replaces the old smooth-stone / torch / smooth-stone stack and
# its protective barriers entirely (5 blocks -> 1). A block display disguises it
# as smooth stone, scaled a hair over 1 so it fully covers the redstone block
# without z-fighting, so from the side (e.g. on a bridge) it still reads as a
# plain stone support. The brightness override is required: a display samples
# the light of the cell it sits in, and that cell holds the opaque redstone
# block (light 0), so without it the display renders solid black.
#
# The display is enlarged a hair in Y and Z (only) so its visible faces -- the
# underside and the two sides seen from a bridge -- sit just outside the
# redstone block and don't z-fight it. X is left at exactly 1 so neighbouring
# supports (one block apart along the track) touch but never overlap; their
# X-faces are flush against the adjacent redstone blocks and hidden anyway.
# Overlapping them (as a uniform >1 scale did) made the seams shimmer.
# Must run positioned at the head marker.
setblock ~ ~-1 ~ minecraft:redstone_block
execute align xyz run summon minecraft:block_display ~ ~-1 ~ {Tags:["ir_disp"],block_state:{Name:"minecraft:smooth_stone"},brightness:{sky:15,block:15},transformation:{translation:[0f,-0.005f,-0.005f],scale:[1f,1.01f,1.01f],left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f]}}
