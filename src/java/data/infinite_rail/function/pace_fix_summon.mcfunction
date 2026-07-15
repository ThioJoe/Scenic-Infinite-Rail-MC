# Macro helper for pace_fix: re-summon a vanished pace cart on the built
# track (same NBT as begin's original summon -- invulnerable, rolling
# east). summon only takes literal coordinates, so they arrive as macro
# args from storage infinite_rail:fix.
$summon minecraft:minecart $(x) $(y) $(z) {Tags:["ir_cart"],Invulnerable:1b,Motion:[0.5,0.0,0.0]}
