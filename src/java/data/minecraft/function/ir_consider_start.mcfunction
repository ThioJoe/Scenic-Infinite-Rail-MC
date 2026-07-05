# Dual-dialect call bridge (Java half). The shared brain files cannot spell an
# engine-specific function path (Java "infinite_rail:consider_start" vs Bedrock
# "infinite_rail/consider_start"), so they call the bare name "ir_consider_start" instead --
# which Java resolves in the minecraft namespace to this one-line trampoline,
# and Bedrock resolves to the trampoline at its functions/ root. Both hop
# straight into the shared file; nothing else may live here.
function infinite_rail:consider_start
